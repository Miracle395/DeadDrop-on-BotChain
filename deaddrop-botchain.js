// deaddrop-botchain.js
// ethers.js integration for DeadDrop on BOT Chain MAINNET
// Paste into existing frontend, replacing the old testnet wallet + contract calls.

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

const CONTRACT_ADDRESS = "0xE9eA2311B3FC8Eb90CE3e739e2aFDF2dF0A125Cc";

const CONTRACT_ABI = [
  "event DropCreated(uint256 indexed dropId, address indexed sender, address indexed recipient, bytes32 commitment)",
  "event DropRead(uint256 indexed dropId, address indexed reader)",
  "event FeeUpdated(uint256 oldFee, uint256 newFee)",
  "event OwnerChanged(address indexed oldOwner, address indexed newOwner)",
  "event Withdrawn(address indexed to, uint256 amount)",
  "function createDrop(address recipient, bytes32 commitment) payable returns (uint256 dropId)",
  "function readDrop(uint256 dropId) external",
  "function drops(uint256) view returns (address sender, address recipient, bytes32 commitment, bool read, uint64 createdAt, uint64 readAt)",
  "function getDrop(uint256 dropId) view returns (address sender, address recipient, bytes32 commitment, bool read, uint64 createdAt, uint64 readAt)",
  "function feePerDrop() view returns (uint256)",
  "function nextDropId() view returns (uint256)",
  "function owner() view returns (address)",
  "function setFee(uint256 newFee) external",
  "function withdraw(address payable to, uint256 amount) external",
  "function transferOwnership(address newOwner) external"
];

// confirm these against BotChain's mainnet docs before going live.

const BOT_CHAIN_MAINNET = {
  chainId: "0x2a5",
  chainName: "BOT Chain Mainnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18   // verify against BOT Chain's own docs if you have access — Chainlist doesn't list this
  },
  rpcUrls: ["https://rpc.botchain.ai"],
  blockExplorerUrls: ["https://scan.botchain.ai"]
};

const BOT_CHAIN_MAINNET_ID = 677n;

// ---------------------------------------------------------------------------
// Wallet / network setup
// ---------------------------------------------------------------------------

/**
 * Connects MetaMask/BO Wallet and ensures the user is on BOT Chain mainnet.
 * Returns { provider, signer, address }.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found (MetaMask / BO Wallet).");
  }

  let provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (network.chainId !== BOT_CHAIN_MAINNET_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BOT_CHAIN_MAINNET.chainId }]
      });
    } catch (switchError) {
      // 4902 = chain not added yet
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BOT_CHAIN_MAINNET]
        });
      } else {
        throw switchError;
      }
    }
    // Re-create the provider so it binds fresh to the now-switched chain,
    // instead of reusing the instance that cached the old network.
    provider = new ethers.BrowserProvider(window.ethereum);
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

if (window.ethereum) {
  window.ethereum.on('chainChanged', () => {
    window.location.reload();
  });
}

function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ---------------------------------------------------------------------------
// Fee helper
// ---------------------------------------------------------------------------

/** Fetches the current per-drop fee (in wei) directly from the contract. */
export async function getFeePerDrop(providerOrSigner) {
  const contract = getContract(providerOrSigner);
  return contract.feePerDrop();
}

// ---------------------------------------------------------------------------
// Create drop
// ---------------------------------------------------------------------------

/**
 * Creates a new drop on-chain. Pays the required fee automatically.
 * @param {ethers.Signer} signer
 * @param {string} recipient - address, or ethers.ZeroAddress for an open, link-only drop
 * @param {string} commitment - bytes32 hex string, hash commitment referencing off-chain ciphertext
 * @returns {Promise<{ dropId: bigint, txHash: string }>}
 */
export async function createDrop(signer, recipient, commitment) {
  const contract = getContract(signer);

  const fee = await contract.feePerDrop();

  let tx;
  try {
    tx = await contract.createDrop(recipient, commitment, { value: fee });
  } catch (err) {
    throw decodeContractError(err, contract);
  }

  const receipt = await tx.wait();

  // Pull dropId out of the DropCreated event rather than assuming an order,
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
 * Use for the commitment input (e.g. hash of the ciphertext + key material together).
 */
export function hashContent(data) {
  const bytes = typeof data === "string" ? ethers.toUtf8Bytes(data) : data;
  return ethers.keccak256(bytes);
}

// ---------------------------------------------------------------------------
// Read drop
// ---------------------------------------------------------------------------

/**
 * Marks a drop as read. Throws with a decoded reason on revert
 * (already read, not the intended recipient, etc).
 * @param {ethers.Signer} signer
 * @param {bigint|number} dropId
 * @returns {Promise<{ txHash: string, reader: string }>}
 */
export async function readDrop(signer, dropId) {
  const contract = getContract(signer);

  let tx;
  try {
    tx = await contract.readDrop(dropId);
  } catch (err) {
    throw decodeContractError(err, contract);
  }

  const receipt = await tx.wait();

  const iface = contract.interface;
  let readEvent = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "DropRead") {
        readEvent = parsed.args;
        break;
      }
    } catch {
      // skip
    }
  }

  if (!readEvent) {
    throw new Error("DropRead event not found in receipt — check tx on explorer.");
  }

  return {
    txHash: receipt.hash,
    reader: readEvent.reader
  };
}

/** Attempts to decode a revert reason into a readable message. */
function decodeContractError(err, contract) {
  const data = err?.data ?? err?.error?.data;
  if (data) {
    try {
      const decoded = contract.interface.parseError(data);
      return new Error(`Contract reverted: ${decoded.name}`);
    } catch {
      // fall through — this contract uses require() strings, not custom errors,
      // so the revert reason is usually already in err.reason or err.shortMessage
    }
  }
  return err;
}

// ---------------------------------------------------------------------------
// Listen for read (real-time, for sender-side UI feedback)
// ---------------------------------------------------------------------------

/**
 * Subscribes to DropRead for a specific dropId.
 * @param {ethers.Provider} provider
 * @param {bigint|number} dropId
 * @param {(event: { reader: string, txHash: string }) => void} onRead
 * @returns {() => void} unsubscribe function
 */
export function listenForRead(provider, dropId, onRead) {
  const contract = getContract(provider);
  const filter = contract.filters.DropRead(dropId);

  const handler = (dId, reader, event) => {
    onRead({ reader, txHash: event.log.transactionHash });
  };

  contract.on(filter, handler);

  return () => {
    contract.off(filter, handler);
  };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Fetches a drop's on-chain state. Throws if the drop doesn't exist. */
export async function getDrop(providerOrSigner, dropId) {
  const contract = getContract(providerOrSigner);
  try {
    return await contract.getDrop(dropId);
  } catch (err) {
    throw decodeContractError(err, contract);
  }
}
