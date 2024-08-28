import { Address, Hex } from "viem";
import type { components } from "./serverTypes";
import { PublicKey } from "@solana/web3.js";

/**
 * ERC20 token with contract address and amount
 */
export type TokenAmount = {
  token: Address;
  amount: bigint;
};
/**
 * TokenPermissions struct for permit2
 */
export type TokenPermissions = {
  token: Address;
  amount: bigint;
};
export type BidId = string;
export type ChainId = string;
/**
 * Bid parameters
 */
export type BidParams = {
  /**
   * Bid amount in wei
   */
  amount: bigint;
  /**
   * Bid nonce, used to prevent replay of a submitted signature.
   * This can be set to a random uint256 when creating a new signature
   */
  nonce: bigint;
  /**
   * Unix timestamp for when the bid is no longer valid in seconds
   */
  deadline: bigint;
};

export type OpportunityAdapterConfig = {
  /**
   * The chain id as a u64
   */
  chain_id: number;
  /**
   * The opportunity factory address
   */
  opportunity_adapter_factory: Address;
  /**
   * The hash of the bytecode used to initialize the opportunity adapter
   */
  opportunity_adapter_init_bytecode_hash: Hex;
  /**
   * The permit2 address
   */
  permit2: Address;
  /**
   * The weth address
   */
  weth: Address;
};
/**
 * Represents a valid opportunity ready to be executed
 */
export type Opportunity = {
  /**
   * The chain id where the opportunity will be executed.
   */
  chainId: ChainId;

  /**
   * Unique identifier for the opportunity
   */
  opportunityId: string;
  /**
   * Permission key required for successful execution of the opportunity.
   */
  permissionKey: Hex;
  /**
   * Contract address to call for execution of the opportunity.
   */
  targetContract: Address;
  /**
   * Calldata for the targetContract call.
   */
  targetCalldata: Hex;
  /**
   * Value to send with the targetContract call.
   */
  targetCallValue: bigint;
  /**
   * Tokens required to repay the debt
   */
  sellTokens: TokenAmount[];
  /**
   * Tokens to receive after the opportunity is executed
   */
  buyTokens: TokenAmount[];
};
/**
 * Represents a bid for an opportunity
 */
export type OpportunityBid = {
  /**
   * Opportunity unique identifier in uuid format
   */
  opportunityId: string;
  /**
   * The permission key required for successful execution of the opportunity.
   */
  permissionKey: Hex;
  /**
   * Executor address
   */
  executor: Address;
  /**
   * Signature of the executor
   */
  signature: Hex;

  bid: BidParams;
};
/**
 * All the parameters necessary to represent an opportunity
 */
export type OpportunityParams = Omit<Opportunity, "opportunityId">;

export type Bid = BidEvm | BidSvm;
/**
 * Represents a raw EVM bid on acquiring a permission key
 */
export type BidEvm = {
  /**
   * The permission key to bid on
   * @example 0xc0ffeebabe
   *
   */
  permissionKey: Hex;
  /**
   * @description Amount of bid in wei.
   * @example 10
   */
  amount: bigint;
  /**
   * @description Calldata for the targetContract call.
   * @example 0xdeadbeef
   */
  targetCalldata: Hex;
  /**
   * @description The chain id to bid on.
   * @example sepolia
   */
  chainId: ChainId;
  /**
   * @description The targetContract address to call.
   * @example 0xcA11bde05977b3631167028862bE2a173976CA11
   */
  targetContract: Address;
  /**
   * @description The execution environment for the bid.
   */
  env: "evm";
};
/**
 * Represents a raw SVM bid on acquiring a permission key
 */
export type BidSvm = {
  /**
   * The permission key to bid on, as a base58-encoded string.
   * @example pY7StmNLgHT4Uih59r4joWS5cKj1zztd3YbSacsauWY
   *
   */
  permissionKey: string;
  /**
   * @description Amount of bid in wei.
   * @example 10
   * // TODO: this is not covering the case where 2**53-1 < bid < 2**64
   */
  amount: number;
  /**
   * @description Transaction object, as a base64-encoded string.
   * @example SGVsbG8sIFdvcmxkIQ
   */
  transaction: string;
  /**
   * @description The chain id to bid on.
   * @example solana
   */
  chainId: ChainId;
  /**
   * @description The execution environment for the bid.
   */
  env: "svm";
};
export type BidStatusUpdate = {
  id: BidId;
} & components["schemas"]["BidStatus"];

export type BidResponse = components["schemas"]["SimulatedBid"];
export type BidsResponse = {
  items: BidResponse[];
};

export type SvmConstantsConfig = {
  relayerSigner: PublicKey;
  feeReceiverRelayer: PublicKey;
  expressRelayProgram: PublicKey;
};
