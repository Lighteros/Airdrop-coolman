use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct ClaimStatus {
    /// vaa_hash value
    pub vaa_hash: [u8; 32],
    /// The ethereum NFT addresses
    pub nft: [u8; 20],
    /// NFT id
    pub id: u16,
    /// If true, this nft is claimed
    pub is_claimed: bool,
}
