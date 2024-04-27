use hex::FromHexError;

pub fn is_valid_ethereum_address(address: String) -> bool {
    // Check if the address starts with '0x' and is 42 characters long
    if address.starts_with("0x") && address.len() == 42 {
        // Check if the rest of the address is hexadecimal
        for c in address[2..].chars() {
            if !c.is_ascii_hexdigit() {
                return false;
            }
        }
        true
    } else {
        false
    }
}

pub fn ethereum_address_str_to_u8_32(addr: String) -> Result<[u8; 32], FromHexError> {
    // Check if the address starts with "0x" and remove it
    let trimmed_address = addr.trim_start_matches("0x");
    
    // Ensure the address is 40 characters long after removing "0x"
    if trimmed_address.len() != 40 {
        return Err(FromHexError::InvalidStringLength);
    }
    
    // Decode the hex string to bytes
    let decoded_bytes = hex::decode(trimmed_address)?;
    
    // Initialize a [u8; 32] array with zeros for padding
    let mut address_u8_32 = [0u8; 32];
    
    // Copy the 20 decoded bytes into the last 20 bytes of the [u8; 32] array (zero-padding the high bits)
    address_u8_32[12..].copy_from_slice(&decoded_bytes);
    
    Ok(address_u8_32)
}