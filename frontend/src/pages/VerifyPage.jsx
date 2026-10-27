import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getChainConfig, KIND_LABELS, readRegistry, sha256OfFile } from "../lib/mst";

// Public, trustless verification: hashes the file in the browser and reads EvidenceRegistry directly on MST.
export const VerifyPage = () => {
  const [cfg, setCfg] = useState(null);
  const [hash, setHash] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getChainConfig().then(setCfg).catch((e) => setError(e.message));
  }, []);

  const check = async (sha) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!/^(0x)?[0-9a-fA-F]{64}$/.test(sha)) throw new Error("Enter a 64-character SHA-256 hash or choose a file.");
      setResult({ sha, ...(await readRegistry(sha)) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sha = await sha256OfFile(file);
    setHash(sha);
    check(sha);
  };

  return (
    <div className="min-h-screen bg-[#F2ECE6] text-[#101010] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl uppercase">Verify on MST Blockchain</h1>
          <Link to="/" className="underline text-sm">Home</Link>
        </div>
        <p className="text-sm">
          Check whether a site photo, delivery challan or clearance certificate was anchored by CONSTRA. The file is hashed in your
          browser (it is never uploaded) and the result is read directly from the EvidenceRegistry contract on MST.
        </p>

        {cfg && (
          <div className="border border-[#101010] bg-white p-3 font-mono text-xs space-y-1">
            <p>Network: MST {cfg.network} (chain {cfg.chain_id})</p>
            <p className="break-all">
              Contract:{" "}
              {cfg.contract_address ? (
                <a className="underline" href={`${cfg.explorer_url}/address/${cfg.contract_address}`} target="_blank" rel="noreferrer">{cfg.contract_address}</a>
              ) : "not configured"}
            </p>
          </div>
        )}

        <div className="border-2 border-[#101010] bg-white p-4 space-y-3">
          <label className="block text-xs font-bold uppercase">Choose a file</label>
          <input type="file" onChange={onFile} className="block text-sm" />
          <label className="block text-xs font-bold uppercase pt-2">or paste a SHA-256 hash</label>
          <div className="flex gap-2">
            <input value={hash} onChange={(e) => setHash(e.target.value.trim())} placeholder="e3b0c442…" className="flex-1 border border-[#101010] px-2 py-1 font-mono text-xs" />
            <button type="button" onClick={() => check(hash)} disabled={busy} className="px-4 py-1 bg-[#101010] text-[#F2ECE6] text-xs font-bold uppercase cursor-pointer disabled:opacity-50">
              {busy ? "Checking…" : "Verify"}
            </button>
          </div>
        </div>

        {error && <p className="text-[#ba1a1a] font-bold text-sm">{error}</p>}

        {result && (
          <div className={`border-2 p-4 font-mono text-xs space-y-1 ${result.anchored ? "border-[#296a49] bg-white" : "border-[#ba1a1a] bg-white"}`}>
            <p className="text-base font-bold">{result.anchored ? "✔ AUTHENTIC — anchored on MST" : "✘ NOT FOUND on MST"}</p>
            <p className="break-all">SHA-256: {result.sha}</p>
            {result.anchored && (
              <>
                <p>Type: {KIND_LABELS[result.kind] ?? `kind ${result.kind}`}</p>
                <p>Anchored at: {result.time}</p>
                <p className="break-all">
                  Anchored by:{" "}
                  <a className="underline" href={`${result.explorer}/address/${result.by}`} target="_blank" rel="noreferrer">{result.by}</a>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
