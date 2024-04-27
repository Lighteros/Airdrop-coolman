use anchor_lang::prelude::error_code;

#[error_code]
pub enum AirdropError {
    #[msg("Invalid NFT Address.")]
    InvalidNFTAddress,
    #[msg("InvalidForeignEmitter")]
    InvalidForeignEmitter,
    #[msg("InvalidForeignEmitterChain")]
    InvalidForeignEmitterChain,
    #[msg("Drop already claimed.")]
    DropAlreadyClaimed,
    #[msg("InvalidMessage")]
    InvalidMessage,
    #[msg("VerificationFailed")]
    VerificationFailed,
}
