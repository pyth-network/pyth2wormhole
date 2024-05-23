use {
    crate::params::PostUpdateAtomicParams,
    anchor_lang::prelude::*,
};

pub struct PostUpdateAtomic<'info> {
    pub payer:                anchor_lang::solana_program::account_info::AccountInfo<'info>,
    ///Instead we do the same steps in deserialize_guardian_set_checked.
    pub guardian_set:         anchor_lang::solana_program::account_info::AccountInfo<'info>,
    pub config:               anchor_lang::solana_program::account_info::AccountInfo<'info>,
    pub treasury:             anchor_lang::solana_program::account_info::AccountInfo<'info>,
    ///The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    ///Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    pub system_program:       anchor_lang::solana_program::account_info::AccountInfo<'info>,
    pub write_authority:      anchor_lang::solana_program::account_info::AccountInfo<'info>,
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for PostUpdateAtomic<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = vec![];
        account_metas.push(anchor_lang::solana_program::instruction::AccountMeta::new(
            anchor_lang::Key::key(&self.payer),
            true,
        ));
        account_metas.push(
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                anchor_lang::Key::key(&self.guardian_set),
                false,
            ),
        );
        account_metas.push(
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                anchor_lang::Key::key(&self.config),
                false,
            ),
        );
        account_metas.push(anchor_lang::solana_program::instruction::AccountMeta::new(
            anchor_lang::Key::key(&self.treasury),
            false,
        ));
        account_metas.push(anchor_lang::solana_program::instruction::AccountMeta::new(
            anchor_lang::Key::key(&self.price_update_account),
            true,
        ));
        account_metas.push(
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                anchor_lang::Key::key(&self.system_program),
                false,
            ),
        );
        account_metas.push(
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                anchor_lang::Key::key(&self.write_authority),
                true,
            ),
        );
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdateAtomic<'info> {
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = vec![];
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(
            &self.guardian_set,
        ));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(
            &self.treasury,
        ));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(
            &self.price_update_account,
        ));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(
            &self.system_program,
        ));
        account_infos.extend(anchor_lang::ToAccountInfos::to_account_infos(
            &self.write_authority,
        ));
        account_infos
    }
}

pub fn post_update_atomic<'info>(
    ctx: anchor_lang::context::CpiContext<'_, '_, '_, 'info, PostUpdateAtomic<'info>>,
    params: PostUpdateAtomicParams,
) -> anchor_lang::Result<()> {
    let ix = {
        let mut ix_data = AnchorSerialize::try_to_vec(&params)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
        let mut data = [49, 172, 84, 192, 175, 180, 52, 234].to_vec();
        data.append(&mut ix_data);
        let accounts = ctx.to_account_metas(None);
        anchor_lang::solana_program::instruction::Instruction {
            program_id: crate::ID,
            accounts,
            data,
        }
    };
    let acc_infos = ctx.to_account_infos();
    anchor_lang::solana_program::program::invoke_signed(&ix, &acc_infos, ctx.signer_seeds)
        .map_or_else(|e| Err(Into::into(e)), |_| Ok(()))
}
