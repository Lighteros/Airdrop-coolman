use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use std::io::{self, Read};

#[derive(Clone)]
pub struct AirdropMessage {
    pub account: [u8; 32],
    pub nft: [u8; 20],
    pub id: u16,
}

impl AnchorDeserialize for AirdropMessage {
    fn deserialize_reader<R: Read>(buf: &mut R) -> io::Result<Self> {
        let mut buffer = [0u8; 54];
        buf.read_exact(&mut buffer)?;

        // Prepare arrays to hold the account and nft data.
        let mut account = [0u8; 32];
        let mut nft = [0u8; 20];

        // Copy data from buffer into the arrays.
        account.copy_from_slice(&buffer[0..32]);
        nft.copy_from_slice(&buffer[32..52]);

        // Extract the id directly from the buffer as before.
        let id = u16::from_be_bytes([buffer[52], buffer[53]]);

        Ok(AirdropMessage { account, nft, id })
    }
}

impl AnchorSerialize for AirdropMessage {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        let AirdropMessage { account, nft, id } = self;
        account.serialize(writer)?;
        nft.serialize(writer)?;
        id.to_be_bytes().serialize(writer)?;
        Ok(())
    }
}