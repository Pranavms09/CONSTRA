import React, { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../api/client";
import { linkWallet, signCertificateOnChain } from "../lib/mst";

// On-chain status of a clearance certificate on MST Blockchain, with BridgeKey wallet actions for the auditor.
export const MstCertificatePanel = ({ certificate }) => {
  const [anchor, setAnchor] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const certId = certificate?.id;
  const refresh = useCallback(async () => {
    if (!certId) return;
    const [a, u] = await Promise.all([apiFetch(`/chain/anchors/certificate/${certId}`).catch(() => null), fetchMe().catch(() => null)]);
    setAnchor(a);
    setMe(u);
  }, [certId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!certificate?.id) return null;

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const anchored = anchor?.status === "anchored";
  const btn = "px-3 py-1.5 bg-[#101010] text-[#F2ECE6] font-label-code text-label-code uppercase font-bold cursor-pointer disabled:opacity-50";

  return (
    <div className="border border-[#101010] bg-white p-3 space-y-2 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#504533] uppercase font-bold">MST BLOCKCHAIN ANCHOR</span>
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${anchored ? "bg-[#296a49] text-white" : "bg-[#FCBC18] text-[#101010]"}`}>
          {anchor ? anchor.status.replace("_", " ") : "not queued"}
        </span>
      </div>

      {anchored && (
        <div className="space-y-1">
          <p>
            Anchored by <span className="font-bold break-all">{anchor.anchored_by}</span> at {anchor.anchored_at}
          </p>
          {anchor.explorer_url && (
            <a className="underline font-bold" href={anchor.explorer_url} target="_blank" rel="noreferrer">
              View transaction on MSTScan ↗
            </a>
          )}
        </div>
      )}

      {!anchored && anchor?.status === "awaiting_signature" && (
        <button type="button" className={btn} disabled={!!busy} onClick={() => run("sign", () => signCertificateOnChain(certificate.id, certificate.certificate_hash))}>
          {busy === "sign" ? "WAITING FOR BRIDGEKEY…" : "SIGN ON MST WITH BRIDGEKEY"}
        </button>
      )}

      {!anchored && anchor && anchor.status !== "awaiting_signature" && (
        <p>The CONSTRA relayer is anchoring this certificate on MST; refresh in a few seconds.</p>
      )}

      {me?.role === "auditor" && !me.wallet_address && (
        <button type="button" className={btn} disabled={!!busy} onClick={() => run("link", linkWallet)}>
          {busy === "link" ? "CONFIRM IN BRIDGEKEY…" : "LINK BRIDGEKEY WALLET (SIGN FUTURE CERTIFICATES YOURSELF)"}
        </button>
      )}

      <button type="button" className="underline text-[10px] cursor-pointer" onClick={() => run("refresh", async () => {})}>
        refresh
      </button>
      {error && <p className="text-[#ba1a1a] font-bold">{error}</p>}
    </div>
  );
};
