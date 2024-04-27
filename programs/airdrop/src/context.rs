use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};
use wormhole_anchor_sdk::wormhole;

use crate::{state::{AirdropData, ForeignEmitter}, AirdropError, AirdropMessage, ClaimStatus};

#[derive(Accounts)]
#[instruction(chain: u16)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"airdrop_data".as_ref()], bump, space = 8 + 20 + 20 + 20 + 8 + 8 + 32 + 32 + 8, payer = payer)]
    pub airdrop_data: Account<'info, AirdropData>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        seeds = [
            ForeignEmitter::SEED_PREFIX,
            &chain.to_le_bytes()[..]
        ],
        bump,
        space = ForeignEmitter::MAXIMUM_SIZE
    )]
    /// Foreign Emitter account. Create this account if an emitter has not been
    /// registered yet for this Wormhole chain ID. If there already is an
    /// emitter address saved in this account, overwrite it.
    pub foreign_emitter: Account<'info, ForeignEmitter>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"airdrop_data".as_ref()], bump, constraint = airdrop_data.mint == mint.key())]
    pub airdrop_data: Account<'info, AirdropData>,
    #[account(mut, token::mint = mint, token::authority = payer)]
    pub source_account: Account<'info, TokenAccount>,
    #[account(init, seeds = [b"airdrop".as_ref(), mint.key().as_ref()], bump, payer = payer, token::mint = mint, token::authority = destination_account)]
    pub destination_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(nft: [u8; 20], id: u16, vaa_hash: [u8; 32])]
pub struct Claim<'info> {
    // Wormhole program.
    pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

    #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program
    )]
    /// Verified Wormhole message account. The Wormhole program verified
    /// signatures and posted the account data here. Read-only.
    pub posted: Account<'info, wormhole::PostedVaa<AirdropMessage>>,

    #[account(
        seeds = [
            ForeignEmitter::SEED_PREFIX,
            &posted.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_emitter.verify(posted.emitter_address()) @ AirdropError::InvalidNFTAddress
    )]
    /// Foreign emitter account. The posted message's `emitter_address` must
    /// agree with the one we have registered for this message's `emitter_chain`
    /// (chain ID). Read-only.
    pub foreign_emitter: Account<'info, ForeignEmitter>,

    #[account(seeds = [b"airdrop_data".as_ref()], bump, constraint = airdrop_data.mint == mint.key())]
    pub airdrop_data: Account<'info, AirdropData>,

    #[account(init, seeds = [nft.as_ref(), id.to_be_bytes().as_ref()], bump, payer = payer, space = 8 + 32 + 20 + 2 + 1)]
    pub claim_status: Account<'info, ClaimStatus>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"airdrop".as_ref(), mint.key().as_ref()], bump, token::mint = mint, token::authority = source_account)]
    pub source_account: Account<'info, TokenAccount>,
    #[account(init, payer = payer, associated_token::mint = mint, associated_token::authority = payer)]
    pub ata_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}