import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as listen from "./listen";
import * as rest from "./rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";


let configFile: string = ".env";
if (process.env.PYTH_RELAY_CONFIG) {
  configFile = process.env.PYTH_RELAY_CONFIG;
}

console.log("Loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

setDefaultWasm("node");

// Set up the logger.
helpers.initLogger();

if (
  listen.init() &&
  rest.init()
) {
  // Start the Prometheus client with the app name and http port
  let promPort = 8081;
  if (process.env.PROM_PORT) {
    promPort = parseInt(process.env.PROM_PORT);
  }
  logger.info("prometheus client listening on port " + promPort);
  const promClient = new PromHelper("pyth_relay", promPort);

  listen.run(promClient);
  rest.run();
}
