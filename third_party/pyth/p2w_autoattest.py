#!/usr/bin/env python3

# This script sets up a simple loop for periodical attestation of Pyth data
import json
import logging
import os
import re
import sys
import threading
from http.client import HTTPConnection
from subprocess import PIPE, STDOUT, Popen

from pyth_utils import *

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s | %(module)s | %(levelname)s | %(message)s"
)

P2W_SOL_ADDRESS = os.environ.get(
    "P2W_SOL_ADDRESS", "P2WH424242424242424242424242424242424242424"
)
P2W_OWNER_KEYPAIR = os.environ.get(
    "P2W_OWNER_KEYPAIR", "/usr/src/solana/keys/p2w_owner.json"
)
P2W_ATTESTATIONS_PORT = int(os.environ.get("P2W_ATTESTATIONS_PORT", 4343))
P2W_INITIALIZE_SOL_CONTRACT = os.environ.get("P2W_INITIALIZE_SOL_CONTRACT", None)

PYTH_TEST_ACCOUNTS_HOST = "pyth"
PYTH_TEST_ACCOUNTS_PORT = 4242

P2W_ATTESTATION_CFG = os.environ.get("P2W_ATTESTATION_CFG", None)

WORMHOLE_ADDRESS = os.environ.get(
    "WORMHOLE_ADDRESS", "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"
)

# attester needs string, but we validate as int first
P2W_RPC_TIMEOUT_SECS = str(int(os.environ.get("P2W_RPC_TIMEOUT_SECS", "20")))

if SOL_AIRDROP_AMT > 0:
    # Fund the p2w owner
    sol_run_or_die(
        "airdrop",
        [
            str(SOL_AIRDROP_AMT),
            "--keypair",
            P2W_OWNER_KEYPAIR,
            "--commitment",
            "finalized",
        ],
    )

if P2W_INITIALIZE_SOL_CONTRACT is not None:
    # Get actor pubkeys
    P2W_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", P2W_OWNER_KEYPAIR], capture_output=True
    ).stdout.strip()
    PYTH_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", PYTH_PROGRAM_KEYPAIR], capture_output=True
    ).stdout.strip()

    init_result = run_or_die(
        [
            "pyth2wormhole-client",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            P2W_OWNER_KEYPAIR,
            "init",
            "--wh-prog",
            WORMHOLE_ADDRESS,
            "--owner",
            P2W_OWNER_ADDRESS,
            "--pyth-owner",
            PYTH_OWNER_ADDRESS,
        ],
        capture_output=True,
        die=False,
    )

    if init_result.returncode != 0:
        logging.error(
            "NOTE: pyth2wormhole-client init failed, retrying with set_config"
        )
        run_or_die(
            [
                "pyth2wormhole-client",
                "--p2w-addr",
                P2W_SOL_ADDRESS,
                "--rpc-url",
                SOL_RPC_URL,
                "--payer",
                P2W_OWNER_KEYPAIR,
                "set-config",
                "--owner",
                P2W_OWNER_KEYPAIR,
                "--new-owner",
                P2W_OWNER_ADDRESS,
                "--new-wh-prog",
                WORMHOLE_ADDRESS,
                "--new-pyth-owner",
                PYTH_OWNER_ADDRESS,
            ],
            capture_output=True,
        )

# Retrieve available symbols from the test pyth publisher if not provided in envs
if P2W_ATTESTATION_CFG is None:
    P2W_ATTESTATION_CFG = "./attestation_cfg_test.yaml"
    conn = HTTPConnection(PYTH_TEST_ACCOUNTS_HOST, PYTH_TEST_ACCOUNTS_PORT)

    conn.request("GET", "/")

    res = conn.getresponse()

    publisher_state_map = {}

    if res.getheader("Content-Type") == "application/json":
        publisher_state_map = json.load(res)
    else:
        logging.error("Bad Content type")
        sys.exit(1)

    pyth_accounts = publisher_state_map["symbols"]

    logging.info(
        f"Retrieved {len(pyth_accounts)} Pyth accounts from endpoint: {pyth_accounts}"
    )

    mapping_addr = publisher_state_map["mapping_addr"]

    cfg_yaml = f"""
---
mapping_addr: {mapping_addr}
mapping_reload_interval_mins: 1 # Very fast for testing purposes
min_rpc_interval_ms: 0 # RIP RPC
max_batch_jobs: 1000 # Where we're going there's no oomkiller
symbol_groups:
  - group_name: fast_interval_only
    conditions:
      min_interval_secs: 1
    symbols:
"""

    # integer-divide the symbols in ~half for two test
    # groups. Assumes arr[:idx] is exclusive, and arr[idx:] is
    # inclusive
    third_len = len(pyth_accounts) // 3;

    for thing in pyth_accounts[:third_len]:
        name = thing["name"]
        price = thing["price"]
        product = thing["product"]

        cfg_yaml += f"""
      - type: name
        name: {name}
        price_addr: {price}
        product_addr: {product}"""

    # End of fast_interval_only

    cfg_yaml += f"""
  - group_name: longer_interval_sensitive_changes
    conditions:
      min_interval_secs: 10
      price_changed_bps: 300
    symbols:
"""

    for stuff in pyth_accounts[third_len:-third_len]:
        name = stuff["name"]
        price = stuff["price"]
        product = stuff["product"]

        cfg_yaml += f"""
      - type: name
        name: {name}
        price_addr: {price}
        product_addr: {product}"""

    cfg_yaml += f"""
  - group_name: mapping
    conditions:
      min_interval_secs: 30
      price_changed_bps: 500
    symbols: []
"""

    with open(P2W_ATTESTATION_CFG, "w") as f:
        f.write(cfg_yaml)
        f.flush()


# Set helpfully chatty logging default, filtering especially annoying
# modules like async HTTP requests and tokio runtime logs
os.environ["RUST_LOG"] = os.environ.get("RUST_LOG", "pyth2wormhole_client,solana_client,main,pyth_sdk_solana=trace")

# Send the first attestation in one-shot mode for testing
first_attest_result = run_or_die(
    [
        "pyth2wormhole-client",
        "--commitment",
        "confirmed",
        "--p2w-addr",
        P2W_SOL_ADDRESS,
        "--rpc-url",
        SOL_RPC_URL,
        "--payer",
        P2W_OWNER_KEYPAIR,
        "attest",
        "-f",
        P2W_ATTESTATION_CFG,
        "--timeout",
        P2W_RPC_TIMEOUT_SECS,
    ],
    capture_output=True,
)

logging.info("p2w_autoattest ready to roll!")

# Let k8s know the service is up
readiness_thread = threading.Thread(target=readiness, daemon=True)
readiness_thread.start()

# Do not exit this script if a continuous attestation stops for
# whatever reason (this avoids k8s restart penalty)
while True:
    # Start the child process in daemon mode
    p2w_client_process = Popen(
        [
            "pyth2wormhole-client",
            "--commitment",
            "confirmed",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            P2W_OWNER_KEYPAIR,
            "attest",
            "-f",
            P2W_ATTESTATION_CFG,
            "-d",
            "--timeout",
            P2W_RPC_TIMEOUT_SECS,
        ]
    )

    # Wait for an unexpected process exit
    while p2w_client_process.poll() is None:
        pass

    # Yell if the supposedly non-stop attestation process exits
    logging.warn(f"pyth2wormhole-client stopped unexpectedly with code {p2w_client_process.retcode}")
