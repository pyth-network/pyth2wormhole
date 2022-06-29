// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythInternalStructs.sol";

contract PythStorage {
    struct State {
        address payable wormhole;
        uint16 _deprecatedPyth2WormholeChainId; // Replaced by validDataSources/isValidDataSource
        bytes32 _deprecatedPyth2WormholeEmitter; // Ditto

        // Mapping of cached price information
        // priceId => PriceInfo
        mapping(bytes32 => PythInternalStructs.PriceInfo) latestPriceInfo;

        // For tracking all active emitter/chain ID pairs
        PythInternalStructs.DataSource[] validDataSources;

        // (chainId, emitterAddress) => isValid; takes advantage of
        // constant-time mapping lookup for VM verification
        mapping(bytes32 => bool) isValidDataSource;
    }
}

contract PythState {
    PythStorage.State _state;
}
