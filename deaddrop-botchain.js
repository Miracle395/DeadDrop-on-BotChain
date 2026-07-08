// deaddrop-botchain.js
// ethers.js integration for DeadDrop on BOT Chain testnet
// Paste into existing frontend, replacing Sui/Stellar wallet + contract calls.

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

const CONTRACT_ADDRESS = "0x9A4ADAdFBb9d00885f8948171846ED3F080E4039";

const CONTRACT_ABI = [
  "error AlreadyClaimed()",
  "error DropExpired()",
  "error DropNotFound()",
  "error NotAuthorizedRecipient()",
  "event DropClaimed(uint256 indexed dropId, address indexed claimedBy, bytes32 keyHash)",
  "event DropCreated(uint256 indexed dropId, address indexed sender, address indexed recipient, bytes32 contentHash, bytes32 keyHash, uint64 expiry)",
  "function claimDrop(uint256 dropId) external",
  "function createDrop(address recipient, bytes32 contentHash, bytes32 keyHash, uint64 expiry) external returns (uint256 dropId)",
  "function dropCount() view returns (uint256)",
  "function drops(uint256) view returns (address sender, address recipient, bytes32 contentHash, bytes32 keyHash, uint64 createdAt, uint64 expiry, bool claimed, address claimedBy)",
  "function getDrop(uint256 dropId) view returns (tuple(address sender, address recipient, bytes32 contentHash, bytes32 keyHash, uint64 createdAt, uint64 expiry, bool claimed, address claimedBy))",
  "function verifyContentHash(uint256 dropId, bytes32 hash) view returns (bool)"
];

const BOT_CHAIN_TESTNET = {
  chainId: "0x3C8", // 968
  chainName: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 }, // ⚠️ confirm symbol/decimals
  rpcUrls: ["https://rpc.bohr.life"],
  blockExplorerUrls: ["https://scan.bohr.life/"]
};

// ---------------------------------------------------------------------------
// Wallet / network setup
// ---------------------------------------------------------------------------

/**
 * Connects MetaMask/BO Wallet and ensures the user is on BOT Chain testnet.
 * Returns { provider, signer, address }.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found (MetaMask / BO Wallet).");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (network.chainId !== 968n) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BOT_CHAIN_TESTNET.chainId }]
      });
    } catch (switchError) {
      // 4902 = chain not added yet
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BOT_CHAIN_TESTNET]
        });
      } else {
        throw switchError;
      }
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ---------------------------------------------------------------------------
// Create drop
// ---------------------------------------------------------------------------

/**
 * Creates a new drop on-chain.
 * @param {ethers.Signer} signer
 * @param {string} recipient - address, or ethers.ZeroAddress for open claim
 * @param {string} contentHash - bytes32 hex string, keccak256 of ciphertext
 * @param {string} keyHash - bytes32 hex string, keccak256 of key material
 * @param {number} expiry - unix timestamp, 0 for no expiry
 * @returns {Promise<{ dropId: bigint, txHash: string }>}
 */
export async function createDrop(signer, recipient, contentHash, keyHash, expiry = 0) {
  const contract = getContract(signer);

  const tx = await contract.createDrop(recipient, contentHash, keyHash, expiry);
  const receipt = await tx.wait();

  // Pull dropId out of the DropCreated event rather than assuming it's dropCount - 1,
  // since concurrent creates could race.
  const iface = contract.interface;
  let dropId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "DropCreated") {
        dropId = parsed.args.dropId;
        break;
      }
    } catch {
      // not our event, skip
    }
  }

  if (dropId === null) {
    throw new Error("DropCreated event not found in receipt — check tx on explorer.");
  }

  return { dropId, txHash: receipt.hash };
}

/**
 * Helper: computes a bytes32 keccak256 hash from arbitrary string/bytes content.
 * Use for contentHash / keyHash inputs.
 */
export function hashContent(data) {
  const bytes = typeof data === "string" ? ethers.toUtf8Bytes(data) : data;
  return ethers.keccak256(bytes);
}

// ---------------------------------------------------------------------------
// Claim drop
// ---------------------------------------------------------------------------

/**
 * Claims a drop. Throws with a decoded reason on revert (AlreadyClaimed, DropExpired, etc).
 * @param {ethers.Signer} signer
 * @param {bigint|number} dropId
 * @returns {Promise<{ txHash: string, keyHash: string, claimedBy: string }>}
 */
export async function claimDrop(signer, dropId) {
  const contract = getContract(signer);

  let tx;
  try {
    tx = await contract.claimDrop(dropId);
  } catch (err) {
    throw decodeContractError(err, contract);
  }

  const receipt = await tx.wait();

  const iface = contract.interface;
  let claimedEvent = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "DropClaimed") {
        claimedEvent = parsed.args;
        break;
      }
    } catch {
      // skip
    }
  }

  if (!claimedEvent) {
    throw new Error("DropClaimed event not found in receipt — check tx on explorer.");
  }

  return {
    txHash: receipt.hash,
    keyHash: claimedEvent.keyHash,
    claimedBy: claimedEvent.claimedBy
  };
}

/** Attempts to decode a custom Solidity error into a readable message. */
function decodeContractError(err, contract) {
  const data = err?.data ?? err?.error?.data;
  if (data) {
    try {
      const decoded = contract.interface.parseError(data);
      return new Error(`Contract reverted: ${decoded.name}`);
    } catch {
      // fall through
    }
  }
  return err;
}

// ---------------------------------------------------------------------------
// Listen for claim (real-time, for sender-side UI feedback)
// ---------------------------------------------------------------------------

/**
 * Subscribes to DropClaimed for a specific dropId.
 * @param {ethers.Provider} provider
 * @param {bigint|number} dropId
 * @param {(event: { claimedBy: string, keyHash: string, txHash: string }) => void} onClaimed
 * @returns {() => void} unsubscribe function
 */
export function listenForClaim(provider, dropId, onClaimed) {
  const contract = getContract(provider);
  const filter = contract.filters.DropClaimed(dropId);

  const handler = (dId, claimedBy, keyHash, event) => {
    onClaimed({ claimedBy, keyHash, txHash: event.log.transactionHash });
  };

  contract.on(filter, handler);

  return () => {
    contract.off(filter, handler);
  };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Fetches a drop's on-chain state. Throws DropNotFound-style error if missing. */
export async function getDrop(providerOrSigner, dropId) {
  const contract = getContract(providerOrSigner);
  try {
    return await contract.getDrop(dropId);
  } catch (err) {
    throw decodeContractError(err, contract);
  }
}

/** Verifies a fetched Supabase payload's hash against the on-chain commitment before decrypting. */
export async function verifyContentHash(providerOrSigner, dropId, hash) {
  const contract = getContract(providerOrSigner);
  return contract.verifyContentHash(dropId, hash);
}
