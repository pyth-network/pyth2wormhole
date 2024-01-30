use {
    crate::{
        accounts,
        instruction,
        state::config::{
            Config,
            DataSource,
        },
        PostUpdatesAtomicParams,
        CONFIG_SEED,
        ID,
        TREASURY_SEED,
    },
    anchor_lang::{
        prelude::*,
        system_program,
        InstructionData,
    },
    pythnet_sdk::wire::v1::{
        AccumulatorUpdateData,
        MerklePriceUpdate,
        Proof,
    },
    solana_program::instruction::Instruction,
    wormhole_core_bridge_solana::state::GuardianSet,
};

impl accounts::Initialize {
    pub fn populate(payer: &Pubkey) -> Self {
        let config = get_config_address();
        accounts::Initialize {
            payer: *payer,
            config,
            system_program: system_program::ID,
        }
    }
}

impl accounts::PostUpdatesAtomic {
    pub fn populate(
        payer: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
    ) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address();

        let guardian_set = get_guardian_set_address(wormhole_address, guardian_set_index);

        accounts::PostUpdatesAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}

impl accounts::PostUpdates {
    pub fn populate(payer: Pubkey, encoded_vaa: Pubkey, price_update_account: Pubkey) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address();
        accounts::PostUpdates {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}

impl accounts::Governance {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        accounts::Governance { payer, config }
    }
}

impl accounts::AcceptGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        accounts::AcceptGovernanceAuthorityTransfer { payer, config }
    }
}

impl accounts::ReclaimRent {
    pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Self {
        let _config = get_config_address();
        accounts::ReclaimRent {
            payer,
            price_update_account,
        }
    }
}

impl instruction::Initialize {
    pub fn populate(payer: &Pubkey, initial_config: Config) -> Instruction {
        Instruction {
            program_id: ID,
            accounts:   accounts::Initialize::populate(payer).to_account_metas(None),
            data:       instruction::Initialize { initial_config }.data(),
        }
    }
}

impl instruction::PostUpdates {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        price_update_account: Pubkey,
        merkle_price_update: MerklePriceUpdate,
    ) -> Instruction {
        let post_update_accounts =
            accounts::PostUpdates::populate(payer, encoded_vaa, price_update_account)
                .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   post_update_accounts,
            data:       instruction::PostUpdates {
                price_update: merkle_price_update,
            }
            .data(),
        }
    }
}


impl instruction::PostUpdatesAtomic {
    pub fn populate(
        payer: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
        vaa: Vec<u8>,
        merkle_price_update: MerklePriceUpdate,
    ) -> Instruction {
        let post_update_accounts = accounts::PostUpdatesAtomic::populate(
            payer,
            price_update_account,
            wormhole_address,
            guardian_set_index,
        )
        .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   post_update_accounts,
            data:       instruction::PostUpdatesAtomic {
                params: PostUpdatesAtomicParams {
                    vaa,
                    merkle_price_update,
                },
            }
            .data(),
        }
    }
}


impl instruction::SetDataSources {
    pub fn populate(payer: Pubkey, data_sources: Vec<DataSource>) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::SetDataSources {
                valid_data_sources: data_sources,
            }
            .data(),
        }
    }
}

impl instruction::SetFee {
    pub fn populate(payer: Pubkey, fee: u64) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::SetFee {
                single_update_fee_in_lamports: fee,
            }
            .data(),
        }
    }
}


impl instruction::SetWormholeAddress {
    pub fn populate(payer: Pubkey, wormhole: Pubkey) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::SetWormholeAddress { wormhole }.data(),
        }
    }
}


impl instruction::SetMinimumSignatures {
    pub fn populate(payer: Pubkey, minimum_signatures: u8) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::SetMinimumSignatures { minimum_signatures }.data(),
        }
    }
}

impl instruction::RequestGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey, target_governance_authority: Pubkey) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::RequestGovernanceAuthorityTransfer {
                target_governance_authority,
            }
            .data(),
        }
    }
}

impl instruction::AcceptGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey) -> Instruction {
        let governance_accounts =
            accounts::AcceptGovernanceAuthorityTransfer::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::AcceptGovernanceAuthorityTransfer {}.data(),
        }
    }
}

impl instruction::ReclaimRent {
    pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Instruction {
        let governance_accounts =
            accounts::ReclaimRent::populate(payer, price_update_account).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   governance_accounts,
            data:       instruction::ReclaimRent {}.data(),
        }
    }
}


pub fn get_treasury_address() -> Pubkey {
    Pubkey::find_program_address(&[TREASURY_SEED.as_ref()], &ID).0
}

pub fn get_config_address() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &ID).0
}

pub fn get_guardian_set_address(wormhole_address: Pubkey, guardian_set_index: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            GuardianSet::SEED_PREFIX,
            guardian_set_index.to_be_bytes().as_ref(),
        ],
        &wormhole_address,
    )
    .0
}

pub fn deserialize_accumulator_update_data(
    accumulator_message: Vec<u8>,
) -> Result<(Vec<u8>, Vec<MerklePriceUpdate>)> {
    let accumulator_update_data =
        AccumulatorUpdateData::try_from_slice(accumulator_message.as_slice()).unwrap();

    match accumulator_update_data.proof {
        Proof::WormholeMerkle { vaa, updates } => return Ok((vaa.as_ref().to_vec(), updates)),
    }
}
