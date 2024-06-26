import {
    ComputeBudgetProgram,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    clusterApiUrl,
  } from "@solana/web3.js"
  
  import * as fs from "fs"
  import {
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
  } from "@solana/web3.js"
  import {
    MetadataArgs,
    TokenProgramVersion,
    TokenStandard,
  } from "@metaplex-foundation/mpl-bubblegum"
  import { Metaplex, Nft, keypairIdentity } from "@metaplex-foundation/js"
  
  // This function will return an existing keypair if it's present in the environment variables, or generate a new one if not
  export async function getOrCreateKeypair(walletName: string): Promise<Keypair> {
    // Check if secretKey for `walletName` exist in .env file
    const envWalletKey = process.env[walletName]
  
    let keypair: Keypair
  
    // If no secretKey exist in the .env file for `walletName`
    if (!envWalletKey) {
      console.log(`Writing ${walletName} keypair to .env file...`)
  
      // Generate a new keypair
      keypair = Keypair.generate()
  
      // Save to .env file
      fs.appendFileSync(
        ".env",
        `\n${walletName}=${JSON.stringify(Array.from(keypair.secretKey))}`
      )
    }
    // If secretKey already exists in the .env file
    else {
      // Create a Keypair from the secretKey
      const secretKey = new Uint8Array(JSON.parse(envWalletKey))
      keypair = Keypair.fromSecretKey(secretKey)
    }
  
    // Log public key and return the keypair
    console.log(`${walletName} PublicKey: ${keypair.publicKey.toBase58()}`)
    return keypair
  }
  
  export async function airdropSolIfNeeded(publicKey: PublicKey) {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  
    const balance = await connection.getBalance(publicKey)
    console.log("Current balance is", balance / LAMPORTS_PER_SOL)
  
    if (balance < 1 * LAMPORTS_PER_SOL) {
      try {
        console.log("Airdropping 2 SOL...")
  
        const txSignature = await connection.requestAirdrop(
          publicKey,
          2 * LAMPORTS_PER_SOL
        )
  
        const latestBlockHash = await connection.getLatestBlockhash()
  
        await connection.confirmTransaction(
          {
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: txSignature,
          },
          "confirmed"
        )
  
        const newBalance = await connection.getBalance(publicKey)
        console.log("New balance is", newBalance / LAMPORTS_PER_SOL)
      } catch (e) {
        console.log("Airdrop Unsuccessful, likely rate-limited. Try again later.")
      }
    }
  }
  
  export async function transferSolIfNeeded(sender: Keypair, receiver: Keypair) {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  
    const balance = await connection.getBalance(receiver.publicKey)
    console.log("Current balance is", balance / LAMPORTS_PER_SOL)
  
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      try {
        let ix = SystemProgram.transfer({
          fromPubkey: sender.publicKey,
          toPubkey: receiver.publicKey,
          lamports: LAMPORTS_PER_SOL,
        })

        const priorityFeesInstruction = await getPriorityFees([ix.programId.toBase58()])

        if (priorityFeesInstruction === undefined) {
          throw new Error("Error getting transaction priority fee transaction")
        }
  
        await sendAndConfirmTransaction(connection, new Transaction().add(priorityFeesInstruction).add(ix), [
          sender,
        ])
  
        const newBalance = await connection.getBalance(receiver.publicKey)
        console.log("New balance is", newBalance / LAMPORTS_PER_SOL)
      } catch (e) {
        console.log("SOL Transfer Unsuccessful")
      }
    }
  }
  
  export function createNftMetadata(creator: PublicKey, index: number, collectionMint: PublicKey) {
  
    // Compressed NFT Metadata
    const compressedNFTMetadata: MetadataArgs = {
      name: "Noviciado OG Pass",
      symbol: "OG Pass",
      uri: "https://green-key-hummingbird-678.mypinata.cloud/ipfs/QmVNfBVEhKSbiLNrAiho66wjCPTQDLfqeHMrcrR9sdbSmJ",
      creators: [{ address: creator, verified: false, share: 100 }],
      editionNonce: 0,
      uses: null,
      collection: {
        verified: true,
        key: collectionMint
      },
      primarySaleHappened: false,
      sellerFeeBasisPoints: 10000,
      isMutable: true,
      tokenProgramVersion: TokenProgramVersion.Original,
      tokenStandard: TokenStandard.NonFungible,
    }
  
    return compressedNFTMetadata
  }
  
  export type CollectionDetails = {
    mint: PublicKey
    metadata: PublicKey
    masterEditionAccount: PublicKey
  }
  
  export async function getOrCreateCollectionNFT(
    connection: Connection,
    payer: Keypair
  ): Promise<CollectionDetails> {
    const envCollectionNft = process.env["COLLECTION_NFT"]
  
    // Create Metaplex instance using payer as identity
    const metaplex = new Metaplex(connection).use(keypairIdentity(payer))
  
    if (envCollectionNft) {
      const collectionNftAddress = new PublicKey(envCollectionNft)
      const collectionNft = await metaplex
        .nfts()
        .findByMint({ mintAddress: collectionNftAddress })
  
      if (collectionNft.model !== "nft") {
        throw new Error("Invalid collection NFT")
      }
  
      return {
        mint: collectionNft.mint.address,
        metadata: collectionNft.metadataAddress,
        masterEditionAccount: (collectionNft as Nft).edition.address,
      }
    }
  
    // Select a random URI from uris
  
    // Create a regular collection NFT using Metaplex
    const collectionNft = await metaplex.nfts().create({
      uri: "https://green-key-hummingbird-678.mypinata.cloud/ipfs/QmfQSsfeXesFzv1LUhTnxF2a8pbLyD5JEp2YoXfsdJH9cN",
      name: "Noviciado OG Pass",
      sellerFeeBasisPoints: 0,
      updateAuthority: payer,
      mintAuthority: payer,
      tokenStandard: 0,
      symbol: "OG Pass X3",
      isMutable: true,
      isCollection: true,
      creators: [
        {
          address: payer.publicKey,
          share: 100,
        },
      ],
    })
  
    fs.appendFileSync(
      ".env",
      `\n${"COLLECTION_NFT"}=${collectionNft.mintAddress.toBase58()}`
    )
  
    return {
      mint: collectionNft.mintAddress,
      metadata: collectionNft.metadataAddress,
      masterEditionAccount: collectionNft.masterEditionAddress,
    }
  }

  export async function getPriorityFees(accountKeys: string[]) {
    try {
      if(!process.env?.HELIUS_URL) {
        throw new Error("Missing HELIUS_URL environment variable")
      }
    
      const raw = JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getPriorityFeeEstimate',
        params: [
          {
            accountKeys: accountKeys,
            options: {
              priority_level: 'HIGH',
            },
          },
        ],
      });
    
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
    
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw
      };
    
      const res = await fetch(process.env?.HELIUS_URL, requestOptions)
      const { result } = await res.json()
      const computePriceInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: result.priorityFeeEstimate
      });
    
      if (!result.priorityFeeEstimate) {
        throw new Error("Error getting Priority Fees")
      }
  
      console.log("Transaction Priority Fees", result)
    
      return computePriceInstruction
    } catch (e) {
      console.error(e)
    }
  }