import { PythPriceListener } from "../pyth-price-listener";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import pino from "pino";

jest.mock("@pythnetwork/price-service-client");

describe("PythPriceListener", () => {
  // Constants
  const TEST_FEEDS = {
    BTC: { id: "btc_feed", alias: "BTC/USD", price: "20000", conf: "100" },
    ETH: { id: "eth_feed", alias: "ETH/USD", price: "1500", conf: "50" },
  };

  // Test helpers
  const createMockSubscriptionFeed = (
    id: string,
    price: string,
    conf: string,
    publishTime: number
  ) => ({
    id,
    getPriceNoOlderThan: () => ({
      price,
      conf,
      publishTime,
    }),
  });

  let mockPriceServiceConnection: jest.Mocked<PriceServiceConnection>;

  beforeEach(() => {
    mockPriceServiceConnection = new PriceServiceConnection(
      ""
    ) as jest.Mocked<PriceServiceConnection>;
  });

  it("should log warning when price feeds are stale", async () => {
    jest.useFakeTimers();
    const currentTime = Math.floor(Date.now() / 1000);

    const priceItems = [TEST_FEEDS.BTC, TEST_FEEDS.ETH];
    const logger = pino({ level: "silent" });
    const warnSpy = jest.spyOn(logger, "warn");

    const pythListener = new PythPriceListener(
      mockPriceServiceConnection,
      priceItems,
      logger
    );

    // Mock subscription updates
    mockPriceServiceConnection.subscribePriceFeedUpdates.mockImplementation(
      (_, callback) => {
        // Initial updates for both feeds
        callback(
          createMockSubscriptionFeed(
            TEST_FEEDS.BTC.id,
            TEST_FEEDS.BTC.price,
            TEST_FEEDS.BTC.conf,
            currentTime
          ) as any
        );

        callback(
          createMockSubscriptionFeed(
            TEST_FEEDS.ETH.id,
            TEST_FEEDS.ETH.price,
            TEST_FEEDS.ETH.conf,
            currentTime
          ) as any
        );

        // Continue updating only BTC price
        setInterval(() => {
          callback(
            createMockSubscriptionFeed(
              TEST_FEEDS.BTC.id,
              TEST_FEEDS.BTC.price,
              TEST_FEEDS.BTC.conf,
              currentTime + 30
            ) as any
          );
        }, 5000); // Update every 5 seconds to simulate the actual code

        return Promise.resolve();
      }
    );

    await pythListener.start();

    // Verify initial state
    const btcPrice = pythListener.getLatestPriceInfo("btc_feed");
    const ethPrice = pythListener.getLatestPriceInfo("eth_feed");
    expect(btcPrice).toBeDefined();
    expect(ethPrice).toBeDefined();

    // Advance time and run one interval check
    jest.advanceTimersByTime(31 * 1000);
    jest.runOnlyPendingTimers();

    // Verify warning was logged only about ETH being stale
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        staleFeeds: expect.arrayContaining([
          expect.objectContaining({
            id: "eth_feed",
            alias: "ETH/USD",
            lastPublishTime: currentTime,
          }),
        ]),
      }),
      expect.stringContaining("price feeds haven't updated")
    );

    jest.useRealTimers();
  });

  it("should log warning when no price feed updates received", async () => {
    jest.useFakeTimers();

    const priceItems = [
      { id: "btc_feed", alias: "BTC/USD" },
      { id: "eth_feed", alias: "ETH/USD" },
    ];

    const logger = pino({ level: "silent" });
    const warnSpy = jest.spyOn(logger, "warn");

    const pythListener = new PythPriceListener(
      mockPriceServiceConnection,
      priceItems,
      logger
    );

    // Mock subscription with no updates
    mockPriceServiceConnection.subscribePriceFeedUpdates.mockImplementation(
      () => Promise.resolve()
    );

    await pythListener.start();

    // Verify initial state - no prices
    const btcPrice = pythListener.getLatestPriceInfo("btc_feed");
    const ethPrice = pythListener.getLatestPriceInfo("eth_feed");
    expect(btcPrice).toBeUndefined();
    expect(ethPrice).toBeUndefined();

    // Advance time and run one interval check
    jest.advanceTimersByTime(31 * 1000);
    jest.runOnlyPendingTimers();

    // Verify warning about no updates
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTime: expect.any(Number),
      }),
      "No price feed updates have been received yet"
    );

    jest.useRealTimers();
  });
});
