// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const anchor = require('@coral-xyz/anchor')
const IDL = require('../target/idl/airdrop.json')
const {
  createAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
} = require('@solana/spl-token')
const { Keypair, PublicKey, PublicKeyInitData } = require('@solana/web3.js')
const { deriveAddress } = require('@certusone/wormhole-sdk/lib/cjs/solana')

const secretKey = require('/home/lightning/.config/solana/id.json')

const programId = 'B9DgQsnPpRRPiouQ6yFxDJ4pU82kLfFa3rvbhgzSo5aB'

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider)

  const owner = Keypair.fromSecretKey(Uint8Array.from(secretKey))

  console.log(owner.publicKey.toBase58())

  const program = new anchor.Program(
    IDL,
    new anchor.web3.PublicKey(programId),
    provider
  )

  // const tokenMint = await createMint(
  //   provider.connection,
  //   owner,
  //   owner.publicKey,
  //   null,
  //   0
  // )

  // console.log('mint', tokenMint.toBase58())

  // const sourceAccount = await createAccount(
  //   anchor.getProvider().connection,
  //   owner,
  //   tokenMint,
  //   owner.publicKey
  // )

  // await mintTo(
  //   anchor.getProvider().connection,
  //   owner,
  //   tokenMint,
  //   sourceAccount,
  //   owner,
  //   1000000000
  // )

  const [airdropData] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_data')],
    program.programId
  )

  const emitter_address = '0xc12Db1A03d93fd01eb15DD0d55E9fC5f8f438fC5'
  const nft1 = '0xa5C0Bd78D1667c13BFB403E2a3336871396713c5'
  const nft2 = '0x3243ac6f63f75e260346a14e1d1445f2a2708444'

  const amount1 = new anchor.BN(3750000000000)
  const amount2 = new anchor.BN(1250000000000)

  const tokenMint = new PublicKey('DWVcRtKSS7SjzWVnuSLVaNiL5Ty21SuwoJ6aCufZfTRo')

  function deriveForeignEmitterKey(
    programId,
    chain
  ) {
    return deriveAddress(
      [
        Buffer.from('foreign_emitter'),
        (() => {
          const buf = Buffer.alloc(2)
          buf.writeUInt16LE(chain)
          return buf
        })(),
      ],
      programId
    )
  }

  const tx = await program.methods
    .initialize(10002, emitter_address, nft1, nft2, amount1, amount2)
    .accounts({
      airdropData,
      payer: owner.publicKey,
      mint: tokenMint,
      foreignEmitter: deriveForeignEmitterKey(program.programId, 2),
    })
    .signers([owner])
    .rpc()

  const [destinationAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop'), tokenMint.toBuffer()],
    program.programId
  )

  await program.methods
    .deposit(new anchor.BN(1000000000))
    .accounts({
      airdropData,
      payer: owner.publicKey,
      sourceAccount: new PublicKey('CuZX8fL8FaaLxwpdXSqwGfZmXL8oB1NFsR3bCkseLg7t'),
      destinationAccount,
      mint: tokenMint,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([owner])
    .rpc()
}
