import { createPublicClient, createWalletClient, defineChain, http, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { all, audit, first, nowIso, run } from "../db";
import { normalizeSha256, sha256Hex } from "../lib/util";
import type { Env } from "../types";

// Evidence anchoring on MST Blockchain (EvidenceRegistry contract).
// CHAIN_MODE=mst: hashes are queued in D1 and the relayer (cron + waitUntil) sends anchorMany txs.
// CHAIN_MODE=fake: local development without a key; anchors are simulated immediately.

export const ENTITY_TO_KIND: Record<string, number> = { photo: 1, challan: 2, certificate: 3 };
export const KIND_TO_ENTITY: Record<number, string> = { 1: "photo", 2: "challan", 3: "certificate" };
const MAX_BATCH = 50;
const MAX_ATTEMPTS = 5;
const STALE_MS = 5 * 60_000;

export const REGISTRY_ABI = [
  { type: "function", name: "anchorMany", stateMutability: "nonpayable", inputs: [{ name: "hs", type: "bytes32[]" }, { name: "kinds", type: "uint8[]" }], outputs: [] },
  { type: "function", name: "anchor", stateMutability: "nonpayable", inputs: [{ name: "h", type: "bytes32" }, { name: "kind", type: "uint8" }], outputs: [] },
  { type: "function", name: "verify", stateMutability: "view", inputs: [{ name: "h", type: "bytes32" }], outputs: [{ name: "time", type: "uint256" }, { name: "kind", type: "uint8" }, { name: "by", type: "address" }] },
  { type: "function", name: "setAnchorer", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "allowed", type: "bool" }], outputs: [] },
  { type: "function", name: "isAnchorer", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "event", name: "Anchored", inputs: [{ name: "hash", type: "bytes32", indexed: true }, { name: "kind", type: "uint8", indexed: false }, { name: "time", type: "uint256", indexed: false }, { name: "by", type: "address", indexed: true }] },
] as const;

export const isRealChain = (env: Env) => env.CHAIN_MODE === "mst";

export function chainConfig(env: Env) {
  return {
    mode: isRealChain(env) ? "mst" : "fake",
    network: env.MST_NETWORK,
    chain_id: Number(env.MST_CHAIN_ID),
    rpc_url: env.MST_RPC_URL,
    explorer_url: env.MST_EXPLORER_URL,
    contract_address: env.CONTRACT_ADDRESS || null,
    currency_symbol: env.MST_NETWORK === "mainnet" ? "MSTC" : "tMSTC",
  };
}

export const explorerTx = (env: Env, tx?: string | null) => (tx && isRealChain(env) ? `${env.MST_EXPLORER_URL}/tx/${tx}` : null);

function mstChain(env: Env) {
  return defineChain({
    id: Number(env.MST_CHAIN_ID),
    name: `MST ${env.MST_NETWORK}`,
    nativeCurrency: { name: "MSTC", symbol: chainConfig(env).currency_symbol, decimals: 18 },
    rpcUrls: { default: { http: [env.MST_RPC_URL] } },
    blockExplorers: { default: { name: "MSTScan", url: env.MST_EXPLORER_URL } },
  });
}

export const publicClient = (env: Env) => createPublicClient({ chain: mstChain(env), transport: http(env.MST_RPC_URL) });

function walletClient(env: Env) {
  const key = env.ANCHOR_PRIVATE_KEY?.trim();
  if (!key) throw new Error("ANCHOR_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
  return createWalletClient({ account, chain: mstChain(env), transport: http(env.MST_RPC_URL) });
}

const contract = (env: Env) => {
  if (!env.CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS is not configured");
  return env.CONTRACT_ADDRESS as Address;
};
const bytes32 = (sha: string) => `0x${sha}` as Hex;

/** Writes from the relayer use MST's legacy single-gasPrice transactions. */
async function relayerWrite(env: Env, functionName: "anchorMany" | "setAnchorer", args: readonly unknown[]): Promise<Hex> {
  const wallet = walletClient(env);
  const gasPrice = await publicClient(env).getGasPrice();
  return wallet.writeContract({ address: contract(env), abi: REGISTRY_ABI, functionName, args: args as never, type: "legacy", gasPrice } as never);
}

/** Mirrors the anchor status onto the evidence row the Android app and dashboards read. */
async function syncEvidence(db: D1Database, rows: { entity: string; entity_id: string }[], status: string, tx: string | null, block?: number | null) {
  for (const r of rows.filter((r) => r.entity === "photo")) {
    await run(db, "UPDATE evidence SET blockchain_status = ?, blockchain_tx = COALESCE(?, blockchain_tx), blockchain_block_number = COALESCE(?, blockchain_block_number) WHERE id = ?",
      status, tx, block ?? null, Number(r.entity_id));
  }
}

/**
 * Queues a hash for anchoring (idempotent on sha256). Never throws into the business flow.
 * `awaitSigner` keeps the row out of the relayer queue while an auditor signs it from their wallet.
 */
export async function enqueueAnchor(
  env: Env,
  a: { entity: string; entityId: string | number; sha256: string; projectId?: string | number | null; awaitSigner?: boolean }
): Promise<{ sha256: string; status: string; tx_hash: string | null } | null> {
  try {
    const entity = a.entity.trim().toLowerCase();
    const kind = ENTITY_TO_KIND[entity];
    if (!kind) return null;
    const hash = normalizeSha256(a.sha256);
    const real = isRealChain(env);
    const status = real ? (a.awaitSigner ? "awaiting_signature" : "pending") : "anchored";
    const tx = real ? null : `0xFAKE${(await sha256Hex(hash + Date.now())).slice(0, 58)}`;
    await run(env.DB,
      `INSERT OR IGNORE INTO chain_anchors (sha256, entity, entity_id, project_id, kind, status, tx_hash, chain_id, anchored_at, attempts, simulated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      hash, entity, String(a.entityId), a.projectId == null ? null : String(a.projectId), kind, status, tx, Number(env.MST_CHAIN_ID), real ? null : nowIso(), real ? 0 : 1);
    const row = await first<{ status: string; tx_hash: string | null }>(env.DB, "SELECT status, tx_hash FROM chain_anchors WHERE sha256 = ?", hash);
    return { sha256: hash, status: row!.status, tx_hash: row!.tx_hash };
  } catch (err) {
    console.warn("enqueueAnchor failed:", err);
    return null;
  }
}

async function failOrRetry(env: Env, rows: any[], error: string) {
  for (const r of rows) {
    const attempts = (r.attempts ?? 0) + 1;
    const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await run(env.DB, "UPDATE chain_anchors SET status = ?, attempts = ?, last_error = ?, claimed_at = NULL WHERE sha256 = ?", status, attempts, error.slice(0, 500), r.sha256);
    if (status === "failed") {
      await audit(env.DB, { action: "CHAIN_ANCHOR_MAX_RETRIES_EXCEEDED", entity: r.entity, entityId: r.entity_id, detail: { sha256: r.sha256, error: error.slice(0, 300) } });
      await syncEvidence(env.DB, [r], "failed", null);
    }
  }
}

/** Confirms sent transactions, then claims and sends the next batch. Safe to run concurrently. */
export async function processAnchors(env: Env) {
  if (!isRealChain(env)) return { confirmed: 0, sent: 0 };
  const pc = publicClient(env);
  let confirmed = 0;

  // 1. Confirm in-flight transactions.
  const sent = await all<any>(env.DB, "SELECT * FROM chain_anchors WHERE status = 'sent' AND tx_hash IS NOT NULL");
  const byTx = new Map<string, any[]>();
  for (const r of sent) byTx.set(r.tx_hash, [...(byTx.get(r.tx_hash) ?? []), r]);
  for (const [tx, rows] of byTx) {
    const receipt = await pc.getTransactionReceipt({ hash: tx as Hex }).catch(() => null);
    if (!receipt) {
      const staleRows = rows.filter((r) => Date.now() - Date.parse(r.claimed_at ?? 0) > STALE_MS);
      if (staleRows.length) await failOrRetry(env, staleRows, `Transaction ${tx} not mined within 5 minutes`);
      continue;
    }
    if (receipt.status !== "success") {
      await failOrRetry(env, rows, `Transaction ${tx} reverted`);
      continue;
    }
    const block = await pc.getBlock({ blockNumber: receipt.blockNumber });
    const anchoredAt = new Date(Number(block.timestamp) * 1000).toISOString();
    for (const r of rows) {
      await run(env.DB, "UPDATE chain_anchors SET status = 'anchored', block_number = ?, anchored_at = ?, anchored_by = ?, last_error = NULL WHERE sha256 = ?",
        Number(receipt.blockNumber), anchoredAt, receipt.from, r.sha256);
    }
    await syncEvidence(env.DB, rows, "confirmed", tx, Number(receipt.blockNumber));
    confirmed += rows.length;
  }

  // 2. Atomically claim pending (or stale "sending") rows, then send one anchorMany transaction.
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const claimed = await all<any>(env.DB,
    `UPDATE chain_anchors SET status = 'sending', claimed_at = ?
     WHERE sha256 IN (SELECT sha256 FROM chain_anchors WHERE status = 'pending' OR (status = 'sending' AND claimed_at < ?) ORDER BY created_at LIMIT ?)
     RETURNING *`,
    nowIso(), staleBefore, MAX_BATCH);
  if (!claimed.length) return { confirmed, sent: 0 };

  try {
    const tx = await relayerWrite(env, "anchorMany", [claimed.map((r) => bytes32(r.sha256)), claimed.map((r) => r.kind)]);
    for (const r of claimed) {
      await run(env.DB, "UPDATE chain_anchors SET status = 'sent', tx_hash = ?, attempts = attempts + 1, simulated = 0 WHERE sha256 = ?", tx, r.sha256);
    }
    await syncEvidence(env.DB, claimed, "submitted", tx);
    return { confirmed, sent: claimed.length, tx_hash: tx };
  } catch (err) {
    await failOrRetry(env, claimed, String((err as Error).message ?? err));
    return { confirmed, sent: 0, error: String((err as Error).message ?? err) };
  }
}

/** Reads the EvidenceRegistry directly from MST: the chain, not D1, is the source of truth. */
export async function readOnChain(env: Env, sha: string) {
  const [time, kind, by] = await publicClient(env).readContract({ address: contract(env), abi: REGISTRY_ABI, functionName: "verify", args: [bytes32(sha)] });
  return { time: Number(time), kind: Number(kind), by: by as string };
}

export async function relayerStatus(env: Env) {
  if (!isRealChain(env)) return { wallet_address: "0xSIMULATED_WALLET_ADDRESS", wallet_balance: 10, wallet_low_funds: false };
  try {
    const address = walletClient(env).account.address;
    const balance = Number(await publicClient(env).getBalance({ address })) / 1e18;
    return { wallet_address: address, wallet_balance: balance, wallet_low_funds: balance < 0.005 };
  } catch (err) {
    console.warn("relayer status failed:", err);
    return { wallet_address: null, wallet_balance: null, wallet_low_funds: true };
  }
}

/** Authorizes an auditor's wallet (e.g. BridgeKey) as an anchorer on the registry. */
export async function authorizeAnchorer(env: Env, wallet: Address): Promise<Hex | null> {
  if (!isRealChain(env)) return null;
  const already = await publicClient(env).readContract({ address: contract(env), abi: REGISTRY_ABI, functionName: "isAnchorer", args: [wallet] });
  return already ? null : relayerWrite(env, "setAnchorer", [wallet, true]);
}

/**
 * Accepts a certificate anchor transaction signed by an auditor's wallet after checking the receipt on MST:
 * successful, sent to our registry, from the auditor's linked wallet, and emitting Anchored(certHash).
 */
export async function recordWalletAnchor(env: Env, sha: string, txHash: Hex, wallet: string) {
  const receipt = await publicClient(env).getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("Transaction reverted on MST");
  if (receipt.to?.toLowerCase() !== contract(env).toLowerCase()) throw new Error("Transaction was not sent to the CONSTRA EvidenceRegistry");
  if (receipt.from.toLowerCase() !== wallet.toLowerCase()) throw new Error("Transaction was not signed by your linked wallet");
  const logs = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs, eventName: "Anchored" });
  if (!logs.some((l) => l.args.hash.toLowerCase() === bytes32(sha))) throw new Error("Transaction did not anchor this certificate hash");
  const block = await publicClient(env).getBlock({ blockNumber: receipt.blockNumber });
  await run(env.DB,
    "UPDATE chain_anchors SET status = 'anchored', tx_hash = ?, block_number = ?, anchored_at = ?, anchored_by = ?, simulated = 0, last_error = NULL WHERE sha256 = ?",
    txHash, Number(receipt.blockNumber), new Date(Number(block.timestamp) * 1000).toISOString(), receipt.from, sha);
  return { tx_hash: txHash, block_number: Number(receipt.blockNumber), anchored_by: receipt.from };
}
