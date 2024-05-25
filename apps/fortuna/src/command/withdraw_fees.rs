use {
    crate::{
        api::{
            get_register_uri,
            ChainId,
        },
        chain::ethereum::SignablePythContract,
        config::{
            Config,
            EthereumConfig,
            KeeperConfig,
            ProviderConfig,
            WithdrawFeesOptions,
        },
        state::PebbleHashChain,
    },
    anyhow::{
        anyhow,
        Result,
    },
    ethers::{
        abi::{
            AbiEncode,
            Bytes,
        },
        middleware::Middleware,
        providers::{
            Http,
            Provider,
        },
        signers::{
            LocalWallet,
            Signer,
        },
        types::{
            TransactionReceipt,
            TransactionRequest,
            H160,
            U256,
        },
        utils::parse_units,
    },
    std::sync::Arc,
};


pub async fn withdraw_fees(opts: &WithdrawFeesOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;

    let keeper_address = if opts.cron {
        let keeper_private_key = config
            .keeper
            .private_key
            .load()?
            .ok_or(anyhow!("Please specify a keeper private key in the config"))?;
        Some(keeper_private_key.parse::<LocalWallet>()?.address())
    } else {
        None
    };

    match opts.chain_id.clone() {
        Some(chain_id) => {
            let chain_config = &config.get_chain_config(&chain_id)?;
            withdraw_fees_for_chain(&config.provider, chain_config, &keeper_address).await?;
        }
        None => {
            for (chain_id, chain_config) in config.chains.iter() {
                tracing::info!("Withdrawing fees for chain: {}", chain_id);
                withdraw_fees_for_chain(&config.provider, chain_config, &keeper_address).await?;
            }
        }
    }
    Ok(())
}

pub async fn withdraw_fees_for_chain(
    provider_config: &ProviderConfig,
    chain_config: &EthereumConfig,
    rebalance_to: &Option<H160>,
) -> Result<()> {
    let private_key_string = provider_config.private_key.load()?.ok_or(anyhow!(
        "Please specify a provider private key in the config"
    ))?;

    let contract =
        Arc::new(SignablePythContract::from_config(&chain_config, &private_key_string).await?);
    let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
    let wallet = contract.wallet();

    let balance = provider.get_balance(wallet.address(), None).await?;
    tracing::info!("Initial balances");
    tracing::info!(
        "Provider Address: {:?} Balance: {} wei",
        wallet.address(),
        balance
    );
    if let Some(addr) = rebalance_to {
        let keeper_balance = provider.get_balance(*addr, None).await?;
        tracing::info!("Keeper Address: {:?} Balance: {} wei", addr, keeper_balance);
    }

    tracing::info!("Fetching provider fees");
    let provider_info = contract
        .get_provider_info(provider_config.address)
        .call()
        .await?;
    let fees = provider_info.accrued_fees_in_wei;
    tracing::info!("Accrued fees: {} wei", fees);

    let default_min_balance: U256 = parse_units("0.02", "ether")?.into();
    let min_balance = chain_config
        .provider_min_balance
        .map(|x| U256::from(x))
        .unwrap_or(default_min_balance);

    if U256::from(fees) > min_balance {
        tracing::info!("Claiming accrued fees...");
        let tx_result = contract.withdraw(fees).send().await?.await?;
        log_tx_hash(&tx_result);
    } else {
        tracing::info!("Skipping claim...");
    }

    let balance = provider.get_balance(wallet.address(), None).await?;

    if let Some(rebalance_address) = rebalance_to {
        if balance > min_balance {
            tracing::info!("Funding keeper wallet: ");
            let amount_to_transfer = ethers::types::U256::from(10); // balance - PROVIDER_THRESHOLD

            let transaction = TransactionRequest::new()
                .from(wallet.address())
                .to(*rebalance_address) // Replace with recipient's address
                .value(amount_to_transfer);

            let tx_hash = contract
                .client()
                .send_transaction(transaction, None)
                .await?
                .await?;
            log_tx_hash(&tx_hash);
        }
    }

    tracing::info!("Final balances");
    let balance = provider.get_balance(wallet.address(), None).await?;
    tracing::info!("Initial balances");
    tracing::info!(
        "Provider Address: {:?} Balance: {} wei",
        wallet.address(),
        balance
    );
    if let Some(addr) = rebalance_to {
        let keeper_balance = provider.get_balance(*addr, None).await?;
        tracing::info!("Keeper Address: {:?} Balance: {} wei", addr, keeper_balance);
    }

    Ok(())
}

fn log_tx_hash(receipt: &Option<TransactionReceipt>) {
    match &receipt {
        Some(receipt) => {
            tracing::info!("Claim transaction hash {:?}", receipt.transaction_hash);
        }
        None => {
            tracing::warn!("No transaction receipt. Unclear what happened to the transaction");
        }
    }
}
