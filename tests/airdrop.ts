import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Airdrop } from '../target/types/airdrop'
import { Keypair, PublicKey, PublicKeyInitData } from '@solana/web3.js'
import {
  createAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
} from '@solana/spl-token'
import { expect } from 'chai'
import * as mock from '@certusone/wormhole-sdk/lib/cjs/mock'
import { CHAINS, ChainId, parseVaa, sign } from '@certusone/wormhole-sdk'
import { CORE_BRIDGE_PID, boilerPlateReduction } from './helpers.ts'
import { derivePostedVaaKey } from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole'
import { deriveAddress } from '@certusone/wormhole-sdk/lib/cjs/solana'

describe('airdrop', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.Airdrop as Program<Airdrop>

  const owner = Keypair.generate()

  let tokenMint: PublicKey
  let sourceAccount: PublicKey
  let destinationAccount: PublicKey
  let [airdropData] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_data')],
    program.programId
  )

  const {
    requestAirdrop,
    guardianSign,
    postSignedMsgAsVaaOnSolana,
    expectIxToSucceed,
    expectIxToFailWithError,
  } = boilerPlateReduction(anchor.getProvider().connection, owner)

  // foreign emitter info
  const realForeignEmitterChain = CHAINS.ethereum
  const realForeignEmitterAddress = Buffer.alloc(32, 'deadbeef', 'hex')

  const realEmitter = new mock.MockEmitter(
    realForeignEmitterAddress.toString('hex'),
    realForeignEmitterChain
  )

  const batchId = 0

  const createPayload = (account: PublicKey, nft: string, id: number) => {
    const buf = Buffer.alloc(54)
    Buffer.from(account.toBytes()).copy(buf)
    Buffer.from('a5c0bd78d1667c13bfb403e2a3336871396713c5', 'hex').copy(buf, 32)
    buf.writeUint16BE(id, 52)
    return buf
  }

  const publishAndSign = (payload: Buffer, emitter: mock.MockEmitter) => {
    const finality = 1
    return guardianSign(emitter.publishMessage(batchId, payload, finality))
  }

  function deriveForeignEmitterKey(
    programId: PublicKeyInitData,
    chain: number
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

  const signedMsg = publishAndSign(
    createPayload(
      owner.publicKey,
      'a5c0bd78d1667c13bfb403e2a3336871396713c5',
      12345
    ),
    realEmitter
  )

  before(async () => {
    const AIRDROP_AMOUNT = 10000000000
    await anchor
      .getProvider()
      .connection.confirmTransaction(
        await anchor
          .getProvider()
          .connection.requestAirdrop(owner.publicKey, AIRDROP_AMOUNT),
        'confirmed'
      )
    const info = await anchor
      .getProvider()
      .connection.getAccountInfo(CORE_BRIDGE_PID)
    console.log(info)

    tokenMint = await createMint(
      anchor.getProvider().connection,
      owner,
      owner.publicKey,
      null,
      0
    )

    sourceAccount = await createAccount(
      anchor.getProvider().connection,
      owner,
      tokenMint,
      owner.publicKey
    )

    let tx = await mintTo(
      anchor.getProvider().connection,
      owner,
      tokenMint,
      sourceAccount,
      owner,
      1000000000
    )

    ;[destinationAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('airdrop'), tokenMint.toBuffer()],
      program.programId
    )
  })

  it('Is initialized!', async () => {
    const tx = await program.methods
      .initialize(
        2,
        '0x00000000000000000000000000000000deadbeef',
        '0xa5c0bd78d1667c13bfb403e2a3336871396713c5',
        '0xa5c0bd78d1667c13bfb403e2a3336871396713c5',
        new anchor.BN(100),
        new anchor.BN(200)
      )
      .accounts({
        airdropData,
        payer: owner.publicKey,
        mint: tokenMint,
        foreignEmitter: deriveForeignEmitterKey(
          program.programId,
          2,
        )
      })
      .signers([owner])
      .rpc()

    const data = await program.account.airdropData.fetch(airdropData)
    expect(data.amount.toString()).to.equal('0')
  })

  it('Deposits!', async () => {
    const tx = await program.methods
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
    const data = await program.account.airdropData.fetch(airdropData)
    expect(data.amount.toString()).to.equal('1000000000')
  })

  it('Post Wormhole Message!', async () => {
    await expect(postSignedMsgAsVaaOnSolana(signedMsg, owner)).to.be.fulfilled
  })

  it('Claim!', async () => {
    const parsed = parseVaa(signedMsg)
    const buf = Buffer.alloc(2)
    buf.writeUInt16BE(12345)
    const [claimStatus] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('a5c0bd78d1667c13bfb403e2a3336871396713c5', 'hex'),
        buf
      ],
      program.programId
    )

    const ataAccount = getAssociatedTokenAddressSync(tokenMint, owner.publicKey)

    const tx = await program.methods
      .claim([...Buffer.from('a5c0bd78d1667c13bfb403e2a3336871396713c5', 'hex')], 12345, [
        ...parsed.hash,
      ])
      .accounts({
        wormholeProgram: new PublicKey(CORE_BRIDGE_PID),
        posted: derivePostedVaaKey(program.programId, parsed.hash),
        foreignEmitter: deriveForeignEmitterKey(
          program.programId,
          parsed.emitterChain
        ),
        airdropData,
        claimStatus,
        payer: owner.publicKey,
        sourceAccount: destinationAccount,
        ataAccount,
        mint: tokenMint,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc()
  })
})
