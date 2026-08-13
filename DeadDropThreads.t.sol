// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeadDropThreads} from "../src/DeadDropThreads.sol";

contract DeadDropThreadsTest is Test {
    DeadDropThreads threads;

    // Foundry's vm.addr/vm.sign work off private keys, so we mint our own
    // test accounts here instead of using arbitrary addresses.
    uint256 relayerPk = 0xA11CE;
    uint256 alicePk = 0xA1;
    uint256 bobPk = 0xB2;
    uint256 mallorPk = 0xEE1; // non-participant, used for negative tests

    address relayer;
    address alice;
    address bob;
    address mallory;

    function setUp() public {
        relayer = vm.addr(relayerPk);
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        mallory = vm.addr(mallorPk);

        threads = new DeadDropThreads(relayer);
    }

    // -----------------------------------------------------------
    // Signature helpers
    // -----------------------------------------------------------

    function _signCreateThread(uint256 signerPk, address a, address b, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(abi.encodePacked("createThread", a, b, nonce, address(threads)));
        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethDigest);
        return abi.encodePacked(r, s, v);
    }

    function _signSendMessage(uint256 signerPk, uint256 threadId, bytes32 ciphertextHash, address sender, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("sendMessage", threadId, ciphertextHash, sender, nonce, address(threads))
        );
        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethDigest);
        return abi.encodePacked(r, s, v);
    }

    function _signReadMessage(uint256 signerPk, uint256 threadId, uint256 messageId, address reader, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("readMessage", threadId, messageId, reader, nonce, address(threads))
        );
        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethDigest);
        return abi.encodePacked(r, s, v);
    }

    // A small end-to-end helper so later tests don't repeat the full setup dance.
    function _createThread(address a, uint256 aPk, address b) internal returns (uint256 threadId) {
        uint256 nonce = threads.nonces(a);
        bytes memory sig = _signCreateThread(aPk, a, b, nonce);
        vm.prank(relayer);
        threadId = threads.createThread(a, b, nonce, sig);
    }

    // -----------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------

    function test_createThread_success() public {
        uint256 threadId = _createThread(alice, alicePk, bob);

        (address pA, address pB, uint64 createdAt, uint256 messageCount) = threads.getThread(threadId);
        assertEq(pA, alice);
        assertEq(pB, bob);
        assertEq(messageCount, 0);
        assertGt(createdAt, 0);
        assertEq(threads.nonces(alice), 1, "nonce should increment after use");
    }

    function test_sendMessage_success() public {
        uint256 threadId = _createThread(alice, alicePk, bob);

        bytes32 ciphertextHash = keccak256("hello bob");
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, nonce);

        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, nonce, sig);

        (, , , uint256 messageCount) = threads.getThread(threadId);
        assertEq(messageCount, 1);

        DeadDropThreads.Message[] memory msgs = threads.getMessages(threadId, 0, 10);
        assertEq(msgs.length, 1);
        assertEq(msgs[0].sender, alice);
        assertEq(msgs[0].ciphertextHash, ciphertextHash);
        assertFalse(msgs[0].read);
        assertFalse(threads.isRead(threadId, messageId));
    }

    function test_readMessage_success() public {
        uint256 threadId = _createThread(alice, alicePk, bob);

        bytes32 ciphertextHash = keccak256("hello bob");
        uint256 sendNonce = threads.nonces(alice);
        bytes memory sendSig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, sendNonce);
        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, sendNonce, sendSig);

        uint256 readNonce = threads.nonces(bob);
        bytes memory readSig = _signReadMessage(bobPk, threadId, messageId, bob, readNonce);
        vm.prank(relayer);
        threads.readMessage(threadId, messageId, bob, readNonce, readSig);

        assertTrue(threads.isRead(threadId, messageId));
        assertEq(threads.nonces(bob), 1);
    }

    // -----------------------------------------------------------
    // Access control
    // -----------------------------------------------------------

    function test_revert_nonRelayerCannotCreateThread() public {
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signCreateThread(alicePk, alice, bob, nonce);

        vm.prank(mallory);
        vm.expectRevert("not relayer");
        threads.createThread(alice, bob, nonce, sig);
    }

    function test_revert_nonRelayerCannotSendMessage() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, nonce);

        vm.prank(mallory);
        vm.expectRevert("not relayer");
        threads.sendMessage(threadId, ciphertextHash, alice, nonce, sig);
    }

    // -----------------------------------------------------------
    // Signature verification (the risky part)
    // -----------------------------------------------------------

    function test_revert_createThread_wrongSigner() public {
        // Mallory signs, but the call claims participantA = alice.
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signCreateThread(mallorPk, alice, bob, nonce);

        vm.prank(relayer);
        vm.expectRevert("invalid signature");
        threads.createThread(alice, bob, nonce, sig);
    }

    function test_revert_sendMessage_wrongSigner() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 nonce = threads.nonces(alice);
        // Bob signs, but claims sender = alice.
        bytes memory sig = _signSendMessage(bobPk, threadId, ciphertextHash, alice, nonce);

        vm.prank(relayer);
        vm.expectRevert("invalid signature");
        threads.sendMessage(threadId, ciphertextHash, alice, nonce, sig);
    }

    function test_revert_readMessage_wrongSigner() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 sendNonce = threads.nonces(alice);
        bytes memory sendSig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, sendNonce);
        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, sendNonce, sendSig);

        uint256 readNonce = threads.nonces(bob);
        // Mallory signs, but claims reader = bob.
        bytes memory readSig = _signReadMessage(mallorPk, threadId, messageId, bob, readNonce);

        vm.prank(relayer);
        vm.expectRevert("invalid signature");
        threads.readMessage(threadId, messageId, bob, readNonce, readSig);
    }

    function test_revert_replayedSignature() public {
        // A valid signed createThread call, submitted twice. Second must
        // fail on nonce, not silently succeed / double-create.
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signCreateThread(alicePk, alice, bob, nonce);

        vm.prank(relayer);
        threads.createThread(alice, bob, nonce, sig);

        vm.prank(relayer);
        vm.expectRevert("bad nonce");
        threads.createThread(alice, bob, nonce, sig); // same nonce, same sig
    }

    function test_revert_staleNonce() public {
        // Alice signs with a stale/future nonce that doesn't match current state.
        uint256 wrongNonce = threads.nonces(alice) + 5;
        bytes memory sig = _signCreateThread(alicePk, alice, bob, wrongNonce);

        vm.prank(relayer);
        vm.expectRevert("bad nonce");
        threads.createThread(alice, bob, wrongNonce, sig);
    }

    // -----------------------------------------------------------
    // Business logic rejection cases
    // -----------------------------------------------------------

    function test_revert_createThread_withSelf() public {
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signCreateThread(alicePk, alice, alice, nonce);

        vm.prank(relayer);
        vm.expectRevert("cannot thread with self");
        threads.createThread(alice, alice, nonce, sig);
    }

    function test_revert_sendMessage_nonParticipant() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 nonce = threads.nonces(mallory);
        bytes memory sig = _signSendMessage(mallorPk, threadId, ciphertextHash, mallory, nonce);

        vm.prank(relayer);
        vm.expectRevert("not a participant");
        threads.sendMessage(threadId, ciphertextHash, mallory, nonce, sig);
    }

    function test_revert_sendMessage_threadDoesNotExist() public {
        bytes32 ciphertextHash = keccak256("hi");
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signSendMessage(alicePk, 999, ciphertextHash, alice, nonce);

        vm.prank(relayer);
        vm.expectRevert("thread does not exist");
        threads.sendMessage(999, ciphertextHash, alice, nonce, sig);
    }

    function test_revert_sendMessage_emptyCommitment() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        uint256 nonce = threads.nonces(alice);
        bytes memory sig = _signSendMessage(alicePk, threadId, bytes32(0), alice, nonce);

        vm.prank(relayer);
        vm.expectRevert("empty commitment");
        threads.sendMessage(threadId, bytes32(0), alice, nonce, sig);
    }

    function test_revert_readMessage_nonParticipant() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 sendNonce = threads.nonces(alice);
        bytes memory sendSig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, sendNonce);
        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, sendNonce, sendSig);

        uint256 readNonce = threads.nonces(mallory);
        bytes memory readSig = _signReadMessage(mallorPk, threadId, messageId, mallory, readNonce);

        vm.prank(relayer);
        vm.expectRevert("not a participant");
        threads.readMessage(threadId, messageId, mallory, readNonce, readSig);
    }

    function test_revert_readMessage_ownMessage() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 sendNonce = threads.nonces(alice);
        bytes memory sendSig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, sendNonce);
        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, sendNonce, sendSig);

        // Alice tries to mark her own message read.
        uint256 readNonce = threads.nonces(alice);
        bytes memory readSig = _signReadMessage(alicePk, threadId, messageId, alice, readNonce);

        vm.prank(relayer);
        vm.expectRevert("cannot read own message");
        threads.readMessage(threadId, messageId, alice, readNonce, readSig);
    }

    function test_revert_readMessage_alreadyRead() public {
        uint256 threadId = _createThread(alice, alicePk, bob);
        bytes32 ciphertextHash = keccak256("hi");
        uint256 sendNonce = threads.nonces(alice);
        bytes memory sendSig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, sendNonce);
        vm.prank(relayer);
        uint256 messageId = threads.sendMessage(threadId, ciphertextHash, alice, sendNonce, sendSig);

        uint256 readNonce1 = threads.nonces(bob);
        bytes memory readSig1 = _signReadMessage(bobPk, threadId, messageId, bob, readNonce1);
        vm.prank(relayer);
        threads.readMessage(threadId, messageId, bob, readNonce1, readSig1);

        uint256 readNonce2 = threads.nonces(bob);
        bytes memory readSig2 = _signReadMessage(bobPk, threadId, messageId, bob, readNonce2);
        vm.prank(relayer);
        vm.expectRevert("already read");
        threads.readMessage(threadId, messageId, bob, readNonce2, readSig2);
    }

    // -----------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------

    function test_getMessages_pagination() public {
        uint256 threadId = _createThread(alice, alicePk, bob);

        for (uint256 i = 0; i < 5; i++) {
            bytes32 ciphertextHash = keccak256(abi.encodePacked("msg", i));
            uint256 nonce = threads.nonces(alice);
            bytes memory sig = _signSendMessage(alicePk, threadId, ciphertextHash, alice, nonce);
            vm.prank(relayer);
            threads.sendMessage(threadId, ciphertextHash, alice, nonce, sig);
        }

        DeadDropThreads.Message[] memory page1 = threads.getMessages(threadId, 0, 2);
        assertEq(page1.length, 2);

        DeadDropThreads.Message[] memory page2 = threads.getMessages(threadId, 2, 2);
        assertEq(page2.length, 2);

        DeadDropThreads.Message[] memory page3 = threads.getMessages(threadId, 4, 2);
        assertEq(page3.length, 1, "last page should clamp to remaining count");

        DeadDropThreads.Message[] memory outOfRange = threads.getMessages(threadId, 10, 2);
        assertEq(outOfRange.length, 0, "offset past messageCount returns empty");
    }

    // -----------------------------------------------------------
    // Admin
    // -----------------------------------------------------------

    function test_setRelayer_onlyOwner() public {
        address newRelayer = vm.addr(0xF00D);

        vm.prank(mallory);
        vm.expectRevert("not owner");
        threads.setRelayer(newRelayer);

        // deployer (this test contract) is owner
        threads.setRelayer(newRelayer);
        assertEq(threads.relayer(), newRelayer);
    }

    function test_transferOwnership_onlyOwner() public {
        vm.prank(mallory);
        vm.expectRevert("not owner");
        threads.transferOwnership(mallory);

        threads.transferOwnership(alice);
        assertEq(threads.owner(), alice);
    }

    // -----------------------------------------------------------
    // Safety
    // -----------------------------------------------------------

    function test_revert_plainTransferRejected() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok, ) = address(threads).call{value: 0.1 ether}("");
        assertFalse(ok, "contract should reject plain transfers");
    }
}
