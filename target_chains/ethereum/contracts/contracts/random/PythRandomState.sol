// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PythRandomStructs {
    struct State {
        uint pythFeeInWei;
        uint accruedPythFeesInWei;
        mapping(address => ProviderInfo) providers;
        mapping(bytes32 => Request) requests;
    }

    struct ProviderInfo {
        uint feeInWei;
        uint accruedFeesInWei;
        // The sequence number that will be assigned to the next inbound user request.
        uint64 sequenceNumber;

        // The current commitment represents an index/value in the provider's hash chain.
        // These values are used to verify requests for future sequence numbers. Note that
        // currentCommitmentSequenceNumber < sequenceNumber.
        //
        // The currentCommitment advances forward through the provider's hash chain as values
        // are revealed on-chain.
        bytes32 currentCommitment;
        uint64 currentCommitmentSequenceNumber;

        // Metadata for the current commitment. Providers may optionally use this field to to help
        // manage rotations (i.e., to pick the sequence number from the correct hash chain).
        bytes32 commitmentMetadata;
        // The first sequence number that is *not* included in the current commitment (i.e., an exclusive end index).
        // The contract maintains the invariant that sequenceNumber <= endSequenceNumber.
        // If sequenceNumber == endSequenceNumber, the provider must rotate their commitment to add additional random values.
        uint64 endSequenceNumber;
    }

    // TODO: add block number?
    struct Request {
        address provider;
        uint64 sequenceNumber;

        bytes32 userCommitment;

        bytes32 providerCommitment;
        uint64 providerCommitmentSequenceNumber;
    }
}

contract PythRandomState {
    PythRandomStructs.State _state;
}
