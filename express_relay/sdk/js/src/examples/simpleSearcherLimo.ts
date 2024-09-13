import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Client } from "../index";
import { BidStatusUpdate } from "../types";
import { SVM_CONSTANTS } from "../const";

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getConfigRouterPda, getExpressRelayMetadataPda } from "../svmPda";

import * as limo from "@kamino-finance/limo-sdk";
import { Decimal } from "decimal.js";
import { OrderStateAndAddress } from "@kamino-finance/limo-sdk/dist/utils";

const DAY_IN_SECONDS = 60 * 60 * 24;

class SimpleSearcherLimo {
  private client: Client;
  private connectionSvm: Connection;
  private clientLimo: limo.LimoClient;
  constructor(
    public endpointExpressRelay: string,
    public chainId: string,
    public privateKey: string,
    public endpointSvm: string,
    public globalConfig: PublicKey,
    public mintSell: PublicKey,
    public mintBuy: PublicKey,
    public apiKey?: string
  ) {
    this.client = new Client(
      {
        baseUrl: endpointExpressRelay,
        apiKey,
      },
      undefined,
      () => {
        return Promise.resolve();
      },
      this.bidStatusHandler.bind(this)
    );
    this.connectionSvm = new Connection(endpointSvm, "confirmed");
    this.clientLimo = new limo.LimoClient(this.connectionSvm, globalConfig);
  }

  async bidStatusHandler(bidStatus: BidStatusUpdate) {
    let resultDetails = "";
    if (bidStatus.type == "submitted" || bidStatus.type == "won") {
      resultDetails = `, transaction ${bidStatus.result}`;
    } else if (bidStatus.type == "lost") {
      if (bidStatus.result) {
        resultDetails = `, transaction ${bidStatus.result}`;
      }
    }
    console.log(
      `Bid status for bid ${bidStatus.id}: ${bidStatus.type.replaceAll(
        "_",
        " "
      )}${resultDetails}`
    );
  }

  async evaluateOrder(order: OrderStateAndAddress) {
    const secretKey = anchor.utils.bytes.bs58.decode(this.privateKey);
    const searcher = Keypair.fromSecretKey(secretKey);

    const inputAmount = new Decimal(
      order.state.remainingInputAmount.toNumber()
    );
    let ixsTakeOrder = await this.clientLimo.takeOrderIx(
      searcher.publicKey,
      order,
      inputAmount,
      new Decimal(argv.bid)
    );
    const txRaw = new anchor.web3.Transaction().add(...ixsTakeOrder);

    const router = Keypair.generate().publicKey;
    const permission = PublicKey.default;
    const bidAmount = new anchor.BN(argv.bid);

    const bid = await this.client.constructSvmBid(
      txRaw,
      searcher.publicKey,
      router,
      permission,
      bidAmount,
      new anchor.BN(Math.round(Date.now() / 1000 + DAY_IN_SECONDS)),
      this.chainId
    );

    try {
      const { blockhash } = await this.connectionSvm.getLatestBlockhash();
      bid.transaction.recentBlockhash = blockhash;
      bid.transaction.sign(Keypair.fromSecretKey(secretKey));
      const bidId = await this.client.submitBid(bid);
      console.log(`Successful bid. Bid id ${bidId}`);
    } catch (error) {
      console.error(`Failed to bid: ${error}`);
    }
  }

  async limoBid() {
    const allOrders =
      await this.clientLimo.getAllOrdersStateAndAddressForInputAndOutputMints(
        new PublicKey(this.mintBuy),
        new PublicKey(this.mintSell)
      );
    allOrders.forEach(async (order) => {
      await this.evaluateOrder(order);
    });
  }

  async start() {
    for (;;) {
      await this.limoBid();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

const argv = yargs(hideBin(process.argv))
  .option("endpoint-express-relay", {
    description:
      "Express relay endpoint. e.g: https://per-staging.dourolabs.app/",
    type: "string",
    demandOption: true,
  })
  .option("chain-id", {
    description: "Chain id to bid on Limo opportunities for. e.g: solana",
    type: "string",
    demandOption: true,
  })
  .option("global-config", {
    description: "Global config address",
    type: "string",
    demandOption: true,
  })
  .option("mint-sell", {
    description: "Sell token mint address",
    type: "string",
    demandOption: true,
  })
  .option("mint-buy", {
    description: "Buy token mint address",
    type: "string",
    demandOption: true,
  })
  .option("bid", {
    description: "Bid amount in lamports",
    type: "string",
    default: "100",
  })
  .option("private-key", {
    description: "Private key to sign the bid with. In 64-byte base58 format",
    type: "string",
    demandOption: true,
  })
  .option("api-key", {
    description:
      "The API key of the searcher to authenticate with the server for fetching and submitting bids",
    type: "string",
    demandOption: false,
  })
  .option("endpoint-svm", {
    description: "SVM RPC endpoint",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();
async function run() {
  if (SVM_CONSTANTS[argv.chainId] === undefined) {
    throw new Error(`SVM constants not found for chain ${argv.chainId}`);
  }
  const searcherSvm = Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(argv.privateKey)
  );
  console.log(`Using searcher pubkey: ${searcherSvm.publicKey.toBase58()}`);

  const simpleSearcher = new SimpleSearcherLimo(
    argv.endpointExpressRelay,
    argv.chainId,
    argv.privateKey,
    argv.endpointSvm,
    new PublicKey(argv.globalConfig),
    new PublicKey(argv.mintSell),
    new PublicKey(argv.mintBuy),
    argv.apiKey
  );
  await simpleSearcher.start();
}

run();
