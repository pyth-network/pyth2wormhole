// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "entropy-sdk-solidity/IEntropy.sol";

library CoinFlipErrors {
    error IncorrectSender();

    error InsufficientFee();
}

/// Example contract using Pyth Entropy to allow a user to flip a secure fair coin.
/// Users interact with the contract by sending two transactions:
/// 1. Users request a coin flip. This operation commits the flip to use a specific (but currently unknown) random number
///    generated by Pyth Entropy.
/// 2. Users reveal the result of the coin flip. This operation reveals the random number from Pyth Entropy and checks
///    its validity, then converts the random number into the result of a coin flip.
contract CoinFlip {
    // Event emitted when a coin flip is requested. The sequence number is required to reveal
    // the result of the flip.
    event FlipRequest(uint64 sequenceNumber);

    // Event emitted when the result of the coin flip is known.
    event FlipResult(bool isHeads);

    // Contracts using Pyth Entropy should import the solidity SDK and then store both the Entropy contract
    // and a specific entropy provider to use for requests. Each provider commits to a sequence of random numbers.
    // Providers are then responsible for two things:
    // 1. Operating an off-chain service that reveals their random numbers once they've been committed to on-chain
    // 2. Maintaining the secrecy of the other random numbers
    // Users should choose a reliable provider who they trust to uphold these commitments.
    // (For the moment, the only available provider is 0x368397bDc956b4F23847bE244f350Bde4615F25E)
    IEntropy private entropy;
    address private entropyProvider;

    // The contract is required to maintain a collection of in-flight requests. This mapping allows the contract
    // to match the revealed random numbers against the original requests. The key of the map can be the
    // sequence number provided by the Entropy protocol, and the value can be whatever information the protocol
    // needs to resolve in-flight requests.
    mapping(uint64 => address) private requestedFlips;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    // Request to flip a coin. The caller should generate a random number prior to calling this method, then
    // submit the hash of that number as userCommitment. (You can call `IEntropy.constructUserCommitment` with
    // the random number to generate the commitment.)
    function requestFlip(bytes32 userCommitment) external payable {
        // The entropy protocol requires the caller to pay a fee (in native gas tokens) per requested random number.
        // This fee can either be paid by the contract itself or passed on to the end user.
        // This implementation of the requestFlip method passes on the fee to the end user.
        uint256 fee = entropy.getFee(entropyProvider);
        if (msg.value < fee) {
            revert CoinFlipErrors.InsufficientFee();
        }

        // Request the random number from the Entropy protocol. The call returns a sequence number that uniquely
        // identifies the generated random number. Callers should save this sequence number so that they can match
        // which request is being revealed in the next stage of the protocol.
        //
        // The final `true` parameter to this method incorporates the blockhash of the request's block into the
        // generated random value. The blockhash adds another level of security and manipulation-resistance to the
        // random value. Set this to `true` unless your blockchain has poor support for retrieving blockhashes.
        uint64 sequenceNumber = entropy.request{value: fee}(
            entropyProvider,
            userCommitment,
            true
        );
        requestedFlips[sequenceNumber] = msg.sender;

        emit FlipRequest(sequenceNumber);
    }

    // Get the fee to flip a coin. See the comment above about fees.
    function getFlipFee() public returns (uint256 fee) {
        fee = entropy.getFee(entropyProvider);
    }

    // Reveal the result of the coin flip. The caller must have an in-flight request for a coin flip, which is
    // identified by `sequenceNumber`. The caller must additionally provide the random number that they previously
    // committed to, as well as the entropy provider's random number. The provider's random number can be retrieved
    // from them in a provider-dependent manner.
    //
    // For the moment, the provider 0x368397bDc956b4F23847bE244f350Bde4615F25E hosts a webservice at
    // https://fortuna-staging.pyth.network/ that allows anyone to retrieve their random values.
    // Fetch the following url:
    // https://fortuna-staging.pyth.network/v1/chains/<chain id>/revelations/<sequence number>
    //
    // The list of supported chain ids is available here https://fortuna-staging.pyth.network/v1/chains
    //
    // **Warning** users of this protocol can stall the protocol by choosing not to reveal their generated random number.
    // Developers using Pyth Entropy should ensure that users are always incentivized (or at least, not disincentivized)
    // to finish both stages of the protocol.
    function revealFlip(
        uint64 sequenceNumber,
        bytes32 userRandom,
        bytes32 providerRandom
    ) public {
        // Validate that the caller is allowed to reveal the result of this particular in-flight request.
        if (requestedFlips[sequenceNumber] != msg.sender) {
            revert CoinFlipErrors.IncorrectSender();
        }
        // Optional: delete the in-flight request to save gas / chain storage.
        delete requestedFlips[sequenceNumber];

        // Reveal the random number. This call reverts if the provided values fail to match the commitments
        // from the request phase. If the call returns, randomNumber is a uniformly distributed bytes32.
        bytes32 randomNumber = entropy.reveal(
            entropyProvider,
            sequenceNumber,
            userRandom,
            providerRandom
        );

        // You can then convert the returned bytes32 into the range required by your application.
        emit FlipResult(uint256(randomNumber) % 2 == 0);
    }

    receive() external payable {}
}
