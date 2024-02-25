/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
  "/v1/bids": {
    /**
     * Bid on a specific permission key for a specific chain.
     * @description Bid on a specific permission key for a specific chain.
     *
     * Your bid will be simulated and verified by the server. Depending on the outcome of the auction, a transaction
     * containing the contract call will be sent to the blockchain expecting the bid amount to be paid after the call.
     */
    post: operations["bid"];
  };
  "/v1/liquidation/opportunities": {
    /**
     * Fetch all liquidation opportunities ready to be exectued.
     * @description Fetch all liquidation opportunities ready to be exectued.
     */
    get: operations["get_opportunities"];
    /**
     * Submit a liquidation opportunity ready to be executed.
     * @description Submit a liquidation opportunity ready to be executed.
     *
     * The opportunity will be verified by the server. If the opportunity is valid, it will be stored in the database
     * and will be available for bidding.
     */
    post: operations["post_opportunity"];
  };
  "/v1/liquidation/opportunities/{opportunity_id}/bids": {
    /**
     * Bid on liquidation opportunity
     * @description Bid on liquidation opportunity
     */
    post: operations["post_bid"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    Bid: {
      /**
       * @description Amount of bid in wei.
       * @example 10
       */
      amount: string;
      /**
       * @description Calldata for the contract call.
       * @example 0xdeadbeef
       */
      calldata: string;
      /**
       * @description The chain id to bid on.
       * @example sepolia
       */
      chain_id: string;
      /**
       * @description The contract address to call.
       * @example 0xcA11bde05977b3631167028862bE2a173976CA11
       */
      contract: string;
      /**
       * @description The permission key to bid on.
       * @example 0xdeadbeef
       */
      permission_key: string;
    };
    BidResult: {
      status: string;
    };
    ClientMessage:
      | {
          /** @enum {string} */
          method: "subscribe";
          params: {
            chain_ids: string[];
          };
        }
      | {
          /** @enum {string} */
          method: "unsubscribe";
          params: {
            chain_ids: string[];
          };
        };
    ClientRequest: components["schemas"]["ClientMessage"] & {
      id: string;
    };
    ErrorBodyResponse: {
      error: string;
    };
    OpportunityBid: {
      /**
       * @description The bid amount in wei.
       * @example 1000000000000000000
       */
      amount: string;
      /**
       * @description Liquidator address
       * @example 0x5FbDB2315678afecb367f032d93F642f64180aa2
       */
      liquidator: string;
      /**
       * @description The opportunity permission key
       * @example 0xdeadbeefcafe
       */
      permission_key: string;
      /** @example 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12 */
      signature: string;
      /**
       * @description How long the bid will be valid for.
       * @example 1000000000000000000
       */
      valid_until: string;
    };
    OpportunityParams: components["schemas"]["OpportunityParamsV1"] & {
      /** @enum {string} */
      version: "v1";
    };
    /**
     * @description Opportunity parameters needed for on-chain execution
     * If a searcher signs the opportunity and have approved enough tokens to liquidation adapter,
     * by calling this contract with the given calldata and structures, they will receive the tokens specified
     * in the receipt_tokens field, and will send the tokens specified in the repay_tokens field.
     */
    OpportunityParamsV1: {
      /**
       * @description Calldata for the contract call.
       * @example 0xdeadbeef
       */
      calldata: string;
      /**
       * @description The chain id where the liquidation will be executed.
       * @example sepolia
       */
      chain_id: string;
      /**
       * @description The contract address to call for execution of the liquidation.
       * @example 0xcA11bde05977b3631167028862bE2a173976CA11
       */
      contract: string;
      /**
       * @description The permission key required for succesful execution of the liquidation.
       * @example 0xdeadbeefcafe
       */
      permission_key: string;
      receipt_tokens: components["schemas"]["TokenQty"][];
      repay_tokens: components["schemas"]["TokenQty"][];
      /**
       * @description The value to send with the contract call.
       * @example 1
       */
      value: string;
    };
    /** @description Similar to OpportunityParams, but with the opportunity id included. */
    OpportunityParamsWithMetadata: (components["schemas"]["OpportunityParamsV1"] & {
      /** @enum {string} */
      version: "v1";
    }) & {
      /**
       * Format: int64
       * @description Creation time of the opportunity
       * @example 1700000000
       */
      creation_time: number;
      /**
       * @description The opportunity unique id
       * @example f47ac10b-58cc-4372-a567-0e02b2c3d479
       */
      opportunity_id: string;
    };
    ServerResultMessage:
      | {
          /** @enum {string} */
          status: "success";
        }
      | {
          result: string;
          /** @enum {string} */
          status: "error";
        };
    /**
     * @description This enum is used to send the result for a specific client request with the same id
     * id is only None when the client message is invalid
     */
    ServerResultResponse: components["schemas"]["ServerResultMessage"] & {
      id?: string | null;
    };
    /** @description This enum is used to send an update to the client for any subscriptions made */
    ServerUpdateResponse: {
      opportunity: components["schemas"]["OpportunityParamsWithMetadata"];
      /** @enum {string} */
      type: "new_opportunity";
    };
    TokenQty: {
      /**
       * @description Token amount
       * @example 1000
       */
      amount: string;
      /**
       * @description Token contract address
       * @example 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
       */
      contract: string;
    };
  };
  responses: {
    BidResult: {
      content: {
        "application/json": {
          status: string;
        };
      };
    };
    /** @description An error occurred processing the request */
    ErrorBodyResponse: {
      content: {
        "application/json": {
          error: string;
        };
      };
    };
    /** @description Similar to OpportunityParams, but with the opportunity id included. */
    OpportunityParamsWithMetadata: {
      content: {
        "application/json": (components["schemas"]["OpportunityParamsV1"] & {
          /** @enum {string} */
          version: "v1";
        }) & {
          /**
           * Format: int64
           * @description Creation time of the opportunity
           * @example 1700000000
           */
          creation_time: number;
          /**
           * @description The opportunity unique id
           * @example f47ac10b-58cc-4372-a567-0e02b2c3d479
           */
          opportunity_id: string;
        };
      };
    };
  };
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export interface operations {
  /**
   * Bid on a specific permission key for a specific chain.
   * @description Bid on a specific permission key for a specific chain.
   *
   * Your bid will be simulated and verified by the server. Depending on the outcome of the auction, a transaction
   * containing the contract call will be sent to the blockchain expecting the bid amount to be paid after the call.
   */
  bid: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["Bid"];
      };
    };
    responses: {
      /** @description Bid was placed succesfully */
      200: {
        content: {
          "application/json": components["schemas"]["BidResult"];
        };
      };
      400: components["responses"]["ErrorBodyResponse"];
      /** @description Chain id was not found */
      404: {
        content: {
          "application/json": components["schemas"]["ErrorBodyResponse"];
        };
      };
    };
  };
  /**
   * Fetch all liquidation opportunities ready to be exectued.
   * @description Fetch all liquidation opportunities ready to be exectued.
   */
  get_opportunities: {
    parameters: {
      query?: {
        /** @example sepolia */
        chain_id?: string | null;
      };
    };
    responses: {
      /** @description Array of liquidation opportunities ready for bidding */
      200: {
        content: {
          "application/json": components["schemas"]["OpportunityParamsWithMetadata"][];
        };
      };
      400: components["responses"]["ErrorBodyResponse"];
      /** @description Chain id was not found */
      404: {
        content: {
          "application/json": components["schemas"]["ErrorBodyResponse"];
        };
      };
    };
  };
  /**
   * Submit a liquidation opportunity ready to be executed.
   * @description Submit a liquidation opportunity ready to be executed.
   *
   * The opportunity will be verified by the server. If the opportunity is valid, it will be stored in the database
   * and will be available for bidding.
   */
  post_opportunity: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["OpportunityParams"];
      };
    };
    responses: {
      /** @description The created opportunity */
      200: {
        content: {
          "application/json": components["schemas"]["OpportunityParamsWithMetadata"];
        };
      };
      400: components["responses"]["ErrorBodyResponse"];
      /** @description Chain id was not found */
      404: {
        content: {
          "application/json": components["schemas"]["ErrorBodyResponse"];
        };
      };
    };
  };
  /**
   * Bid on liquidation opportunity
   * @description Bid on liquidation opportunity
   */
  post_bid: {
    parameters: {
      path: {
        /** @description Opportunity id to bid on */
        opportunity_id: string;
      };
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["OpportunityBid"];
      };
    };
    responses: {
      /** @description Bid Result */
      200: {
        content: {
          "application/json": components["schemas"]["BidResult"];
        };
      };
      400: components["responses"]["ErrorBodyResponse"];
      /** @description Opportunity or chain id was not found */
      404: {
        content: {
          "application/json": components["schemas"]["ErrorBodyResponse"];
        };
      };
    };
  };
}
