// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DeadDropThreads
/// @notice Layer 2 threaded messaging on top of DeadDrop. Users authenticate
///         off-chain (username/password -> client-derived keypair) and sign
///         their own actions; a relayer submits the signed calls on-chain via
///         paymaster, paying gas on the user's behalf. Signature verification
///         means a compromised relayer key can waste gas but cannot forge
///         messages or reads as another user. Ciphertext itself lives off-chain
///         (Supabase); this contract only stores commitment hashes and state.
contract DeadDropThreads {
    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    address public owner;
    address public relayer;

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    struct Thread {
        address participantA;
        address participantB;
        uint64 createdAt;
        uint256 messageCount;
    }

    struct Message {
        address sender;
        bytes32 ciphertextHash;
        uint64 timestamp;
        bool read;
    }

    mapping(uint256 => Thread) public threads;
    uint256 public nextThreadId = 1;

    // threadId => messageId => Message
    mapping(uint256 => mapping(uint256 => Message)) private threadMessages;

    // Replay protection for signed relayer-submitted actions, per signer.
    mapping(address => uint256) public nonces;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event ThreadCreated(uint256 indexed threadId, address indexed participantA, address indexed participantB);
    event MessageSent(uint256 indexed threadId, uint256 indexed messageId, address indexed sender, bytes32 ciphertextHash);
    event MessageRead(uint256 indexed threadId, uint256 indexed messageId, address indexed reader);
    event RelayerChanged(address indexed oldRelayer, address indexed newRelayer);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(address _relayer) {
        require(_relayer != address(0), "zero address");
        owner = msg.sender;
        relayer = _relayer;
    }

    // ---------------------------------------------------------------
    // Core actions
    // ---------------------------------------------------------------

    /// @notice Create a thread between two participants. Relayer-submitted,
    ///         but requires a valid signature from participantA authorizing
    ///         the thread creation, so the relayer cannot originate threads
    ///         a user never requested.
    function createThread(
        address participantA,
        address participantB,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayer returns (uint256 threadId) {
        require(participantA != address(0) && participantB != address(0), "zero address");
        require(participantA != participantB, "cannot thread with self");
        require(nonce == nonces[participantA], "bad nonce");

        bytes32 digest = keccak256(
            abi.encodePacked("createThread", participantA, participantB, nonce, address(this))
        );
        require(_recoverSigner(digest, signature) == participantA, "invalid signature");

        nonces[participantA]++;

        threadId = nextThreadId++;
        threads[threadId] = Thread({
            participantA: participantA,
            participantB: participantB,
            createdAt: uint64(block.timestamp),
            messageCount: 0
        });

        emit ThreadCreated(threadId, participantA, participantB);
    }

    /// @notice Append a message to a thread. Relayer-submitted, but requires
    ///         a valid signature from the claimed sender, and the sender must
    ///         be a participant in the thread.
    function sendMessage(
        uint256 threadId,
        bytes32 ciphertextHash,
        address sender,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayer returns (uint256 messageId) {
        Thread storage t = threads[threadId];
        require(t.participantA != address(0), "thread does not exist");
        require(sender == t.participantA || sender == t.participantB, "not a participant");
        require(ciphertextHash != bytes32(0), "empty commitment");
        require(nonce == nonces[sender], "bad nonce");

        bytes32 digest = keccak256(
            abi.encodePacked("sendMessage", threadId, ciphertextHash, sender, nonce, address(this))
        );
        require(_recoverSigner(digest, signature) == sender, "invalid signature");

        nonces[sender]++;

        messageId = t.messageCount++;
        threadMessages[threadId][messageId] = Message({
            sender: sender,
            ciphertextHash: ciphertextHash,
            timestamp: uint64(block.timestamp),
            read: false
        });

        emit MessageSent(threadId, messageId, sender, ciphertextHash);
    }

    /// @notice Flip a message to read. Relayer-submitted, but requires a
    ///         valid signature from the claimed reader, and the reader must
    ///         be a participant in the thread (and not the original sender).
    function readMessage(
        uint256 threadId,
        uint256 messageId,
        address reader,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRelayer {
        Thread storage t = threads[threadId];
        require(t.participantA != address(0), "thread does not exist");
        require(reader == t.participantA || reader == t.participantB, "not a participant");
        require(nonce == nonces[reader], "bad nonce");

        Message storage m = threadMessages[threadId][messageId];
        require(m.sender != address(0), "message does not exist");
        require(!m.read, "already read");
        require(m.sender != reader, "cannot read own message");

        bytes32 digest = keccak256(
            abi.encodePacked("readMessage", threadId, messageId, reader, nonce, address(this))
        );
        require(_recoverSigner(digest, signature) == reader, "invalid signature");

        nonces[reader]++;

        m.read = true;

        emit MessageRead(threadId, messageId, reader);
    }

    // ---------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------

    function getThread(uint256 threadId)
        external
        view
        returns (address participantA, address participantB, uint64 createdAt, uint256 messageCount)
    {
        Thread storage t = threads[threadId];
        require(t.participantA != address(0), "thread does not exist");
        return (t.participantA, t.participantB, t.createdAt, t.messageCount);
    }

    /// @notice Paginated message read to avoid unbounded gas cost on large
    ///         threads. offset/limit index into the thread's message array.
    function getMessages(uint256 threadId, uint256 offset, uint256 limit)
        external
        view
        returns (Message[] memory result)
    {
        Thread storage t = threads[threadId];
        require(t.participantA != address(0), "thread does not exist");

        if (offset >= t.messageCount) {
            return new Message[](0);
        }

        uint256 end = offset + limit;
        if (end > t.messageCount) {
            end = t.messageCount;
        }

        result = new Message[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = threadMessages[threadId][i];
        }
    }

    function isRead(uint256 threadId, uint256 messageId) external view returns (bool) {
        Message storage m = threadMessages[threadId][messageId];
        require(m.sender != address(0), "message does not exist");
        return m.read;
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "zero address");
        emit RelayerChanged(relayer, newRelayer);
        relayer = newRelayer;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    // ---------------------------------------------------------------
    // Internal: signature recovery (EIP-191 style, matches eth_sign / most
    // client-side signing libraries out of the box)
    // ---------------------------------------------------------------

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "bad signature length");

        bytes32 ethSignedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }

        address signer = ecrecover(ethSignedDigest, v, r, s);
        require(signer != address(0), "invalid signature");
        return signer;
    }

    // ---------------------------------------------------------------
    // Safety: reject stray plain transfers
    // ---------------------------------------------------------------

    receive() external payable {
        revert("this contract does not accept payment");
    }

    fallback() external payable {
        revert("unknown call");
    }
}
