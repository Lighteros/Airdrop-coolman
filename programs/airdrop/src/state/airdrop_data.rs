use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct AirdropData {
    /// The ethereum emitter address
    pub emitter_address: [u8; 20],
    /// The ethereum NFT addresses
    pub nft1: [u8; 20],
    pub nft2: [u8; 20],
    /// Amounts to airdrop for one NFT
    pub amount1: u64,
    pub amount2: u64,
    /// Onwer wallet of this airdrop
    pub owner: Pubkey,
    /// Airdrop token Mint
    pub mint: Pubkey,
    /// Deposit amount
    pub amount: u64,
}
