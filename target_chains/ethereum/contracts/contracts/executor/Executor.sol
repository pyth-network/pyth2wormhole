// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../pyth/PythGovernanceInstructions.sol";
import "../wormhole/interfaces/IWormhole.sol";
import "./ExecutorErrors.sol";

contract Executor {
    using BytesLib for bytes;

    // Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
    // TODO: it's annoying that we can't import this from PythGovernanceInstructions
    uint32 constant MAGIC = 0x5054474d;

    PythGovernanceInstructions.GovernanceModule constant MODULE =
        PythGovernanceInstructions.GovernanceModule.EvmExecutor;

    struct GovernanceInstruction {
        PythGovernanceInstructions.GovernanceModule module;
        ExecutorAction action;
        uint16 targetChainId;
        address executorAddress;
        address callAddress;
        bytes callData;
    }

    enum ExecutorAction {
        Execute // 0
    }

    IWormhole private wormhole;
    uint64 private lastExecutedSequence;
    uint16 private chainId;

    uint16 private ownerEmitterChainId;
    bytes32 private ownerEmitterAddress;

    constructor(
        address _wormhole,
        uint64 _lastExecutedSequence,
        uint16 _chainId,
        uint16 _ownerEmitterChainId,
        bytes32 _ownerEmitterAddress
    ) {
        wormhole = IWormhole(_wormhole);
        lastExecutedSequence = _lastExecutedSequence;
        chainId = _chainId;
        ownerEmitterChainId = _ownerEmitterChainId;
        ownerEmitterAddress = _ownerEmitterAddress;
    }

    function execute(
        bytes memory encodedVm
    ) public returns (bytes memory response) {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVm);

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.targetChainId != chainId && gi.targetChainId != 0)
            revert ExecutorErrors.InvalidGovernanceTarget();

        if (
            gi.action != ExecutorAction.Execute ||
            gi.executorAddress != address(this)
        )
            // TODO
            revert ExecutorErrors.InvalidGovernanceTarget();

        bool success;
        (success, response) = address(gi.callAddress).call(gi.callData);

        // Check if the call was successful or not.
        if (!success) {
            // If there is return data, the delegate call reverted with a reason or a custom error, which we bubble up.
            if (response.length > 0) {
                assembly {
                    let returndata_size := mload(response)
                    revert(add(32, response), returndata_size)
                }
            } else {
                revert ExecutorErrors.ExecutionReverted();
            }
        }
    }

    /// @dev Called when `msg.value` is not zero and the call data is empty.
    receive() external payable {}

    function verifyGovernanceVM(
        bytes memory encodedVM
    ) internal returns (IWormhole.VM memory parsedVM) {
        (IWormhole.VM memory vm, bool valid, ) = wormhole.parseAndVerifyVM(
            encodedVM
        );

        if (!valid) revert ExecutorErrors.InvalidWormholeVaa();

        if (
            vm.emitterChainId != ownerEmitterChainId ||
            vm.emitterAddress != ownerEmitterAddress
        ) revert ExecutorErrors.InvalidGovernanceDataSource();

        if (vm.sequence <= lastExecutedSequence)
            revert ExecutorErrors.OldGovernanceMessage();

        lastExecutedSequence = vm.sequence;

        return vm;
    }

    /// @dev Parse a GovernanceInstruction
    function parseGovernanceInstruction(
        bytes memory encodedInstruction
    ) public pure returns (GovernanceInstruction memory gi) {
        uint index = 0;

        uint32 magic = encodedInstruction.toUint32(index);

        if (magic != MAGIC) revert ExecutorErrors.InvalidGovernanceMessage();

        index += 4;

        uint8 modNumber = encodedInstruction.toUint8(index);
        gi.module = PythGovernanceInstructions.GovernanceModule(modNumber);
        index += 1;

        if (gi.module != MODULE) revert PythErrors.InvalidGovernanceTarget();

        uint8 actionNumber = encodedInstruction.toUint8(index);
        gi.action = ExecutorAction(actionNumber);
        index += 1;

        gi.targetChainId = encodedInstruction.toUint16(index);
        index += 2;

        gi.executorAddress = encodedInstruction.toAddress(index);
        index += 32;

        gi.callAddress = encodedInstruction.toAddress(index);
        index += 32;

        // As solidity performs math operations in a checked mode
        // if the length of the encoded instruction be smaller than index
        // it will revert. So we don't need any extra check.
        gi.callData = encodedInstruction.slice(
            index,
            encodedInstruction.length - index
        );
    }
}
