import { ShyftSdk, Network } from '@shyft-to/js';
import dotenv from "dotenv"
dotenv.config()

async function main() {
    if (!process.env.SHYFT_API_KEY) {
        throw new Error("Missing SHYFT_API_KEY environment variable")
    } else if (!process.env.RECEIVER_WALLET_ADDRESS) {
        throw new Error("Missing RECEIVER_WALLET_ADDRESS environment variable")
    } else if (!process.env.PAYER_WALLET_ADDRESS) {
        throw new Error("Missing PAYER_WALLET_ADDRESS environment variable")
    }
    const receiverWalletAddress = process.env.RECEIVER_WALLET_ADDRESS
    const payerWalletAddress = process.env.PAYER_WALLET_ADDRESS
    const network = Network.Devnet;
    const collectionImageUrl = "https://bafkreidattjvuxzbi7dasz5iyzs5i2wj6b3ckvcr5w7li7bj5s7mvol674.ipfs.nftstorage.link/";
    const solscanOption = network === Network.Devnet ? "?cluster=devnet" : null
    const externalWebsiteUrl = "https://twitter.com/El_Noviciado";

    const cnftImage = "https://nftstorage.link/ipfs/bafkreiccybwv72sz5n7muomxjyaaidv55c567s275ahw3msq4jjvlzfc64"

    const mintNumbers = 2;

    try {
        const shyft = new ShyftSdk({ apiKey: process.env.SHYFT_API_KEY, network: network });
        const balance = await shyft.wallet.getBalance({ wallet: payerWalletAddress });
        console.log(`Payer current balance: ${balance} SOL`)

        console.log("Creating Collection URI...")
        const { uri: collectionUri } = await shyft.storage.createMetadata({
            creator: payerWalletAddress,
            description: "This pass is the first one to be delivered to 420 members of the club.",
            name: "Noviciado OG Pass",
            symbol: "NOP",
            external_url: externalWebsiteUrl,
            image: collectionImageUrl,
            attributes: [{trait_type: "collection", value: "Noviciado OG Pass"}],
        })

        console.log("URI URL:", collectionUri)

        console.log("Creating collection...")
        const collectionRes = await shyft.nft.createFromMetadata({
            metadataUri: collectionUri,
            receiver: receiverWalletAddress,
            feePayer: payerWalletAddress,
            network: network,
        })

        const collectionEncodedTransaction = collectionRes.encoded_transaction;
        const collectionAddress = collectionRes.mint;

        console.log("Signing collection transaction...")
        const collectionTransactionRes = await shyft.txnRelayer.signMany({
            network: network,
            encodedTransactions: [collectionEncodedTransaction],
            commitment: "confirmed"
        })

        const collectionSignature = collectionTransactionRes[0].signature;

        console.log(`Collection's signature: https://solscan.io/tx/${collectionSignature}${solscanOption}`);
        console.log(`Collection mint address: ${collectionAddress}`)


        console.log("Creating merkle tree...")
        const merkleTree = await shyft.nft.compressed.createMerkleTree({
            network: network,
            walletAddress: payerWalletAddress,
            maxDepthSizePair: {
                maxDepth: 3,
                maxBufferSize: 8
            },
            canopyDepth: 0,
            feePayer: payerWalletAddress
        })

        const merkleTreeEncodedTransaction = merkleTree.encoded_transaction;
        const merkleTreeAddress = merkleTree.tree

        console.log("Signing merkle tree transaction...")
        const merkleTreeTransactionRes = await shyft.txnRelayer.signMany({
            network: network,
            encodedTransactions: [merkleTreeEncodedTransaction],
            commitment: "confirmed"
        })

        const merkleTreeSignature = merkleTreeTransactionRes[0].signature;

        console.log(`Merkle Tree's signature: https://solscan.io/tx/${merkleTreeSignature}${solscanOption}`);
        console.log(`Merkle tree address: ${merkleTreeAddress}`)


        console.log("creating cNFT metadata...")
        const { uri: cnftUri } = await shyft.storage.createMetadata({
            creator: payerWalletAddress,
            description: "This pass is the first one to be delivered to 420 members of the club.",
            name: "Noviciado OG Pass",
            symbol: "NOP",
            external_url: externalWebsiteUrl,
            image: cnftImage,
            attributes: [{trait_type: "collection", value: "Noviciado OG Pass"}],
        })


        console.log(`cNFT's metadata URL: ${cnftUri}`);


        console.log("Minting cNFTs...")
        
        const mintEncodedTransactions = [];

        for (let i = 0; i < mintNumbers; i++) {
            const cnftMint = await shyft.nft.compressed.mint({
                network: network,
                creatorWallet: payerWalletAddress,
                merkleTree: merkleTreeAddress,
                metadataUri: cnftUri,
                collectionAddress: collectionAddress,
                isMutable: true,
                feePayer: payerWalletAddress,
                receiver: receiverWalletAddress,
            })

            const cnftMintEncodedTransaction = cnftMint.encoded_transaction;
            const cnftMintAddress = cnftMint.mint;

            mintEncodedTransactions.push(cnftMintEncodedTransaction)
            console.log(`cNFT Mint address ${i + 1}: ${cnftMintAddress}`)
        }
        
        console.log("Signing cNFTs mint transaction...")
        const cnftsMintTransactionRes = await shyft.txnRelayer.signMany({
            network: network,
            encodedTransactions: mintEncodedTransactions,
            commitment: "confirmed"
        })

        const cnftsMintSignature = cnftsMintTransactionRes[0].signature;

        console.log(`cNFT's signature: https://solscan.io/tx/${cnftsMintSignature}${solscanOption}`);
    } catch (e) {
        console.error(e)
    }
}

main()