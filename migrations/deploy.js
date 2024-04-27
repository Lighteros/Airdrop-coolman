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

const secretKey = require('/root/.config/solana/id.json')

const programId = 'HWPt83kCd84ADojQ3naUHDNBScwaYufoTCiJhKPR5MjL'

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

  const tokenMint = await createMint(
    provider.connection,
    owner,
    owner.publicKey,
    null,
    0
  )

  console.log('mint', tokenMint.toBase58())

  const sourceAccount = await createAccount(
    anchor.getProvider().connection,
    owner,
    tokenMint,
    owner.publicKey
  )

  await mintTo(
    anchor.getProvider().connection,
    owner,
    tokenMint,
    sourceAccount,
    owner,
    1000000000
  )

  const [airdropData] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_data')],
    program.programId
  )

  const emitter_address = '0x81621cE0f8356143E214274b5628C7D8Ccb79f61'
  const nft1 = '0xB52B6f8DcDb5a1F9b53A39f0F6a9Ef1E67B4A184'
  const nft2 = '0x8096656497b12Cc5581303c986ed5c5824C9B85f'

  const amount1 = new anchor.BN(10000)
  const amount2 = new anchor.BN(10000)

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
      foreignEmitter: deriveForeignEmitterKey(program.programId, 10002),
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
      sourceAccount,
      destinationAccount,
      mint: tokenMint,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([owner])
    .rpc()
}
