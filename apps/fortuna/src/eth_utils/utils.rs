use {
    anyhow::{anyhow, Result},
    ethers::{contract::ContractCall, middleware::Middleware},
    ethers::types::U256,
    ethers::types::TransactionReceipt,
    std::sync::Arc,
    tracing,
    std::sync::atomic::AtomicU64, 
    crate::config::EscalationPolicyConfig,
    tokio::time::{timeout, Duration},
    backoff::ExponentialBackoff,
};

const TX_CONFIRMATION_TIMEOUT_SECS: u64 = 30;

pub struct SubmitTxResult {
    pub num_retries: u64,
    pub gas_multiplier: u64,
    pub fee_multiplier: u64,
    pub duration: Duration,
    pub receipt: Result<TransactionReceipt, anyhow::Error>,
}

pub async fn send_and_confirm<A: Middleware>(contract_call: ContractCall<A, ()>) -> Result<()> {
    let call_name = contract_call.function.name.as_str();
    let pending_tx = contract_call
        .send()
        .await
        .map_err(|e| anyhow!("Error submitting transaction({}) {:?}", call_name, e))?;

    let tx_result = pending_tx
        .await
        .map_err(|e| {
            anyhow!(
                "Error waiting for transaction({}) receipt: {:?}",
                call_name,
                e
            )
        })?
        .ok_or_else(|| {
            anyhow!(
                "Can't verify the transaction({}), probably dropped from mempool",
                call_name
            )
        })?;

    tracing::info!(
        transaction_hash = &tx_result.transaction_hash.to_string(),
        "Confirmed transaction({}). Receipt: {:?}",
        call_name,
        tx_result,
    );
    Ok(())
}

/// Estimate the cost (in wei) of a transaction consuming gas_used gas.
pub async fn estimate_tx_cost<T: Middleware + 'static>(
    middleware: Arc<T>,
    use_legacy_tx: bool,
    gas_used: u128,
) -> Result<u128> {
    let gas_price: u128 = if use_legacy_tx {
        middleware
            .get_gas_price()
            .await
            .map_err(|e| anyhow!("Failed to fetch gas price. error: {:?}", e))?
            .try_into()
            .map_err(|e| anyhow!("gas price doesn't fit into 128 bits. error: {:?}", e))?
    } else {
        // This is not obvious but the implementation of estimate_eip1559_fees in ethers.rs
        // for a middleware that has a GasOracleMiddleware inside is to ignore the passed-in callback
        // and use whatever the gas oracle returns.
        let (max_fee_per_gas, max_priority_fee_per_gas) =
            middleware.estimate_eip1559_fees(None).await?;

        (max_fee_per_gas + max_priority_fee_per_gas)
            .try_into()
            .map_err(|e| anyhow!("gas price doesn't fit into 128 bits. error: {:?}", e))?
    };

    Ok(gas_price * gas_used)
}

pub async fn submit_tx_with_backoff<T: Middleware + 'static>(
    middleware: Arc<T>,
    call: ContractCall<T, ()>,
    gas_limit: U256,
    escalation_policy: EscalationPolicyConfig,
) -> Result<SubmitTxResult> {
    let start_time = std::time::Instant::now();

    tracing::info!("Started processing event");
    let backoff = ExponentialBackoff {
        max_elapsed_time: Some(Duration::from_secs(300)), // retry for 5 minutes
        ..Default::default()
    };

    let num_retries = Arc::new(AtomicU64::new(0));

    let success = backoff::future::retry_notify(
        backoff,
        || async {
            let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);

            let gas_multiplier_pct = escalation_policy.get_gas_multiplier_pct(num_retries);
            let fee_multiplier_pct = escalation_policy.get_fee_multiplier_pct(num_retries);
            submit_tx(
                middleware.clone(),
                &call,
                gas_limit,
                gas_multiplier_pct,
                fee_multiplier_pct,
            ).await
        },
        |e, dur| {
            let retry_number = num_retries.load(std::sync::atomic::Ordering::Relaxed);
            tracing::error!(
                "Error on retry {} at duration {:?}: {}",
                retry_number,
                dur,
                e
            );
            num_retries.store(retry_number + 1, std::sync::atomic::Ordering::Relaxed);
        },
    )
    .await;

    let duration = start_time.elapsed();    
    let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);

    Ok(SubmitTxResult {
        num_retries: num_retries,
        gas_multiplier: escalation_policy.get_gas_multiplier_pct(num_retries),
        fee_multiplier: escalation_policy.get_fee_multiplier_pct(num_retries),
        duration,
        receipt: success,
    })
}

/// Process a callback on a chain. It estimates the gas for the reveal with callback and
/// submits the transaction if the gas estimate is below the gas limit.
/// It will return a permanent or transient error depending on the error type and whether
/// retry is possible or not.
pub async fn submit_tx<T: Middleware + 'static>(
    client: Arc<T>,
    call: &ContractCall<T, ()>,
    gas_limit: U256,
    // A value of 100 submits the tx with the same gas/fee as the estimate.
    gas_estimate_multiplier_pct: u64,
    fee_estimate_multiplier_pct: u64,
) -> Result<TransactionReceipt, backoff::Error<anyhow::Error>> {
    
    let gas_estimate_res = call.estimate_gas().await;        

    let gas_estimate = gas_estimate_res.map_err(|e| {
        // we consider the error transient even if it is a contract revert since
        // it can be because of routing to a lagging RPC node. Retrying such errors will
        // incur a few additional RPC calls, but it is fine.
        backoff::Error::transient(anyhow!("Error estimating gas for reveal: {:?}", e))
    })?;

    // The gas limit on the simulated transaction is the configured gas limit on the chain,
    // but we are willing to pad the gas a bit to ensure reliable submission.
    if gas_estimate > gas_limit {
        return Err(backoff::Error::permanent(anyhow!(
            "Gas estimate for reveal with callback is higher than the gas limit {} > {}",
            gas_estimate,
            gas_limit
        )));
    }

    // Pad the gas estimate after checking it against the simulation gas limit, ensuring that
    // the padded gas estimate doesn't exceed the maximum amount of gas we are willing to use.
    let gas_estimate = gas_estimate.saturating_mul(gas_estimate_multiplier_pct.into()) / 100;

    let call = call.gas(gas_estimate);

    let mut transaction = call.tx.clone();

    // manually fill the tx with the gas info, so we can log the details in case of error
    client
        .fill_transaction(&mut transaction, None)
        .await
        .map_err(|e| {
            backoff::Error::transient(anyhow!("Error filling the reveal transaction: {:?}", e))
        })?;

    // Apply the fee escalation policy. Note: the unwrap_or_default should never default as we have a gas oracle
    // in the client that sets the gas price.
    transaction.set_gas_price(
        transaction
            .gas_price()
            .unwrap_or_default()
            .saturating_mul(fee_estimate_multiplier_pct.into())
            / 100,
    );

    let pending_tx = client
        .send_transaction(transaction.clone(), None)
        .await
        .map_err(|e| {
            backoff::Error::transient(anyhow!(
                "Error submitting the reveal transaction. Tx:{:?}, Error:{:?}",
                transaction,
                e
            ))
        })?;

    let reset_nonce = || {
        let nonce_manager = client.inner().inner();
        nonce_manager.reset();
    };

    let pending_receipt = timeout(
        Duration::from_secs(TX_CONFIRMATION_TIMEOUT_SECS),
        pending_tx,
    )
    .await
    .map_err(|_| {
        // Tx can get stuck in mempool without any progress if the nonce is too high
        // in this case ethers internal polling will not reduce the number of retries
        // and keep retrying indefinitely. So we set a manual timeout here and reset the nonce.
        reset_nonce();
        backoff::Error::transient(anyhow!(
            "Tx stuck in mempool. Resetting nonce. Tx:{:?}",
            transaction
        ))
    })?;

    let receipt = pending_receipt
        .map_err(|e| {
            backoff::Error::transient(anyhow!(
                "Error waiting for transaction receipt. Tx:{:?} Error:{:?}",
                transaction,
                e
            ))
        })?
        .ok_or_else(|| {
            // RPC may not return an error on tx submission if the nonce is too high.
            // But we will never get a receipt. So we reset the nonce manager to get the correct nonce.
            reset_nonce();
            backoff::Error::transient(anyhow!(
                "Can't verify the reveal, probably dropped from mempool. Resetting nonce. Tx:{:?}",
                transaction
            ))
        })?;

    Ok(receipt)
}
