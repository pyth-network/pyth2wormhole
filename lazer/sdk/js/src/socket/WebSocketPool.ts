import { dummyLogger, type Logger } from "ts-log";
import TTLCache from "@isaacs/ttlcache";
import WebSocket from "isomorphic-ws";
import type { Request, Response } from "../protocol.js";
import { ResilientWebSocket } from "./ResillientWebSocket.js";

// Maintains multiple redundant WebSocket connections for reliability
const DEFAULT_NUM_CONNECTIONS = 3;

export class WebSocketPool {
  rwsPool: ResilientWebSocket[];
  private cache: TTLCache<string, boolean>;
  private subscriptions: Map<number, Request>; // id -> subscription Request
  private messageListeners: ((event: WebSocket.Data) => void)[];

  /**
   * Creates a new WebSocketPool instance that maintains multiple redundant WebSocket connections for reliability.
   * Usage semantics are similar to using a regular WebSocket client.
   * @param urls List of WebSocket URLs to connect to
   * @param token Authentication token to use for the connections
   * @param numConnections Number of parallel WebSocket connections to maintain (default: 3)
   * @param logger Optional logger to get socket level logs. Compatible with most loggers such as the built-in console and `bunyan`.
   */
  constructor(
    urls: string[],
    token: string,
    numConnections: number = DEFAULT_NUM_CONNECTIONS,
    private readonly logger: Logger = dummyLogger
  ) {
    if (urls.length === 0) {
      throw new Error("No URLs provided");
    }
    // This cache is used to deduplicate messages received across different websocket clients in the pool.
    // A TTL cache is used to prevent unbounded memory usage. A very short TTL of 10 seconds is chosen since
    // deduplication only needs to happen between messages received very close together in time.
    this.cache = new TTLCache({ ttl: 1000 * 10 }); // TTL of 10 seconds
    this.rwsPool = [];
    this.subscriptions = new Map();
    this.messageListeners = [];

    for (let i = 0; i < numConnections; i++) {
      const url = urls[i % urls.length]!;
      const wsOptions = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const rws = new ResilientWebSocket(url, wsOptions, logger);

      // If a websocket client unexpectedly disconnects, ResilientWebSocket will reestablish
      // the connection and call the onReconnect callback.
      // When we reconnect, replay all subscription messages to resume the data stream.
      rws.onReconnect = () => {
        if (rws.wsUserClosed === true) {
          return;
        }
        for (const [_, request] of this.subscriptions) {
          rws.send(JSON.stringify(request));
        }
      };
      // Handle all client messages ourselves. Dedupe before sending to registered message handlers.
      rws.onMessage = this.dedupeHandler;
      this.rwsPool.push(rws);
    }

    // Let it rip
    // TODO: wait for sockets to receive `open` msg before subscribing?
    for (const rws of this.rwsPool) {
      rws.startWebSocket();
    }

    this.logger.info(`Using ${numConnections} redundant WebSocket connections`);
  }

  /**
   * Checks for error responses in JSON messages and throws appropriate errors
   */
  private handleErrorMessages(data: string): void {
    const message = JSON.parse(data) as Response;
    if (message.type === "subscriptionError") {
      throw new Error(`Subscription error: ${message}`);
    } else if (message.type === "error") {
      throw new Error(`Error: ${message.error}`);
    }
  }

  /**
   * Handles incoming websocket messages by deduplicating identical messages received across
   * multiple connections before forwarding to registered handlers
   */
  dedupeHandler = (data: WebSocket.Data): void => {
    // For string data, use the whole string as the cache key. This avoids expensive JSON parsing during deduping.
    // For binary data, use the hex string representation as the cache key
    const cacheKey =
      typeof data === "string"
        ? data
        : Buffer.from(data as Buffer).toString("hex");

    // If we've seen this exact message recently, drop it
    if (this.cache.has(cacheKey)) {
      this.logger.debug("Dropping duplicate message");
      return;
    }

    // Haven't seen this message, cache it and forward to handlers
    this.cache.set(cacheKey, true);

    // Check for errors in JSON responses
    if (typeof data === "string") {
      this.handleErrorMessages(data);
    }

    for (const handler of this.messageListeners) {
      handler(data);
    }
  };

  /**
   * Sends a message to all websockets in the pool
   * @param data The data to send
   */
  sendRequest(request: Request) {
    // Send to all websockets in the pool
    for (const rws of this.rwsPool) {
      rws.send(JSON.stringify(request));
    }
  }

  /**
   * Adds a subscription by sending a subscribe request to all websockets in the pool
   * and storing it for replay on reconnection
   * @param request The subscription request to send
   */
  addSubscription(request: Request) {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    this.subscriptions.set(request.subscriptionId, request);
    this.sendRequest(request);
  }

  /**
   * Removes a subscription by sending an unsubscribe request to all websockets in the pool
   * and removing it from stored subscriptions
   * @param subscriptionId The ID of the subscription to remove
   */
  removeSubscription(subscriptionId: number) {
    this.subscriptions.delete(subscriptionId);
    const request: Request = {
      type: "unsubscribe",
      subscriptionId,
    };
    this.sendRequest(request);
  }

  /**
   * Adds a message handler function to receive websocket messages
   * @param handler Function that will be called with each received message
   */
  addMessageListener(handler: (data: WebSocket.Data) => void): void {
    this.messageListeners.push(handler);
  }

  /**
   * Elegantly closes all websocket connections in the pool
   */
  shutdown(): void {
    for (const rws of this.rwsPool) {
      rws.onReconnect = () => {};
      rws.onError = () => {};
      rws.closeWebSocket();
    }
    this.rwsPool = [];
    this.subscriptions.clear();
    this.messageListeners = [];
  }
}
