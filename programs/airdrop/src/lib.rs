use anchor_lang::prelude::*;
use hex::FromHex;

pub use context::*;
pub use error::*;
pub use message::*;
pub use state::*;
pub use utils::*;

pub mod context;
pub mod error;
pub mod message;
pub mod state;
pub mod utils;

declare_id!("HWPt83kCd84ADojQ3naUHDNBScwaYufoTCiJhKPR5MjL");

#[program]
pub mod airdrop {
    use anchor_spl::token::{self, Transfer};

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        chain: u16,
        emitter_address: String,
        nft1: String,
        nft2: String,
        amount1: u64,
        amount2: u64,
    ) -> Result<()> {
        let airdrop_data = &mut ctx.accounts.airdrop_data;
        require!(
            is_valid_ethereum_address(nft1.clone()),
            AirdropError::InvalidNFTAddress
        );
        require!(
            is_valid_ethereum_address(nft2.clone()),
            AirdropError::InvalidNFTAddress
        );

        require!(
            is_valid_ethereum_address(emitter_address.clone()),
            AirdropError::InvalidForeignEmitter
        );

        // Save the emitter info into the ForeignEmitter account.
        let emitter = &mut ctx.accounts.foreign_emitter;
        emitter.chain = chain;
        emitter.address = ethereum_address_str_to_u8_32(emitter_address.clone()).unwrap();

        airdrop_data.emitter_address =
            <[u8; 20]>::from_hex(emitter_address.trim_start_matches("0x")).unwrap();
        airdrop_data.nft1 = <[u8; 20]>::from_hex(nft1.trim_start_matches("0x")).unwrap();
        airdrop_data.nft2 = <[u8; 20]>::from_hex(nft2.trim_start_matches("0x")).unwrap();
        airdrop_data.amount1 = amount1;
        airdrop_data.amount2 = amount2;
        airdrop_data.owner = ctx.accounts.payer.key();
        airdrop_data.mint = ctx.accounts.mint.key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    authority: ctx.accounts.payer.to_account_info(),
                    from: ctx.accounts.source_account.to_account_info(),
                    to: ctx.accounts.destination_account.to_account_info(),
                },
            ),
            amount,
        )?;

        let airdrop_data = &mut ctx.accounts.airdrop_data;
        airdrop_data.amount += amount;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>, nft: [u8; 20], id: u16, vaa_hash: [u8; 32]) -> Result<()> {
        let posted_message = &ctx.accounts.posted;

        let nft_address = nft;
        let nft_id = id;

        let airdrop_data = &ctx.accounts.airdrop_data;

        let foreign_emitter = &ctx.accounts.foreign_emitter;

        let chain = posted_message.emitter_chain();

        require!(
            chain == foreign_emitter.chain,
            AirdropError::InvalidForeignEmitterChain
        );

        let AirdropMessage { account, nft, id } = posted_message.data();
        require!(
            nft_address == nft.clone()
                && Pubkey::new_from_array(account.clone())
                    == ctx.accounts.payer.to_account_info().key()
                && nft_id == id.clone(),
            AirdropError::VerificationFailed
        );

        require!(
            airdrop_data.nft1 == nft_address || airdrop_data.nft2 == nft_address,
            AirdropError::InvalidNFTAddress
        );

        let claim_status = &mut ctx.accounts.claim_status;

        require!(!claim_status.is_claimed, AirdropError::DropAlreadyClaimed);

        let amount = if nft.clone() == airdrop_data.nft1 {
            airdrop_data.amount1
        } else if nft.clone() == airdrop_data.nft2 {
            airdrop_data.amount2
        } else {
            0
        };

        claim_status.vaa_hash = vaa_hash;
        claim_status.is_claimed = true;
        claim_status.nft = nft.clone();
        claim_status.id = id.clone();

        let seeds = &[
            b"airdrop".as_ref(),
            airdrop_data.mint.as_ref(),
            &[ctx.bumps.source_account],
        ];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.source_account.to_account_info(),
                    to: ctx.accounts.ata_account.to_account_info(),
                    authority: ctx.accounts.source_account.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            amount,
        )?;

        Ok(())
    }
}
