import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID, getIxPDA } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { getProposals } from "xc-admin-common";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";

export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

const CLUSTER: string = envOrErr("CLUSTER");
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";
const VAULT: PublicKey = new PublicKey(envOrErr("VAULT"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(
      getPythClusterApiUrl(CLUSTER as PythCluster),
      COMMITMENT
    ),
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });
  const proposals = await getProposals(squad, VAULT, undefined, "executeReady");
  for (const proposal of proposals) {
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length == 0) {
      for (let i = proposal.executedIndex; i < proposal.instructionIndex; i++) {
        const transaction = new Transaction().add(
          await squad.buildExecuteInstruction(
            proposal.publicKey,
            getIxPDA(proposal.publicKey, new BN(i), squad.multisigProgramId)[0]
          )
        );

        try {
          await new AnchorProvider(squad.connection, squad.wallet, {
            commitment: COMMITMENT,
            preflightCommitment: COMMITMENT,
          }).sendAndConfirm(transaction, [KEYPAIR]);
        } catch (error) {
          // Mark the transaction as cancelled if we failed to run it
          await squad.cancelTransaction(proposal.publicKey);
          break;
        }
      }
    }
  }
}

(async () => {
  await run();
})();
