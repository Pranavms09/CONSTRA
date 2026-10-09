import React from "react";

export const AnomalyBanner = ({ anomalyResult }) => {
  if (!anomalyResult || !anomalyResult.is_anomalous) return null;

  const isAlert = anomalyResult.level === "alert";
  const bg = isAlert
    ? "bg-[#ffdad6] border-[#ba1a1a] text-[#ba1a1a]"
    : "bg-[#ffdea2] border-[#7a5900] text-[#7a5900]";
  const title = isAlert ? "CRITICAL CONSUMPTION ANOMALY DETECTED" : "DRAWDOWN THRESHOLD WARNING";

  return (
    <div className={`p-4 border ${bg} font-label-code text-label-code space-y-3`}>
      <div className="flex items-center justify-between pb-2 border-b border-current/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">warning</span>
          <span className="font-bold uppercase tracking-wider">{title}</span>
        </div>
        <span className="px-2 py-0.5 border border-current font-bold uppercase text-[10px]">
          {anomalyResult.level}
        </span>
      </div>

      {anomalyResult.reasons && anomalyResult.reasons.length > 0 && (
        <ul className="list-disc list-inside space-y-1 font-body-sm text-body-sm text-[#101010]">
          {anomalyResult.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {anomalyResult.numbers && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-current/20 text-label-meta">
          <div className="p-2 bg-[#F2ECE6] border border-[#101010] text-[#101010]">
            <span className="text-[#5F5E5E] block uppercase">VERIFIED PROGRESS</span>
            <span className="font-bold text-body-sm">
              {(anomalyResult.numbers.verified_progress * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-2 bg-[#F2ECE6] border border-[#101010] text-[#101010]">
            <span className="text-[#5F5E5E] block uppercase">EXPECTED LIMIT</span>
            <span className="font-bold text-body-sm">
              {Number(anomalyResult.numbers.expected_for_progress || 0).toLocaleString()} kg
            </span>
          </div>
          <div className="p-2 bg-[#F2ECE6] border border-[#101010] text-[#ba1a1a]">
            <span className="text-[#5F5E5E] block uppercase">CUMULATIVE TOTAL</span>
            <span className="font-bold text-body-sm">
              {Number(anomalyResult.numbers.cumulative_total || 0).toLocaleString()} kg
            </span>
          </div>
          <div className="p-2 bg-[#F2ECE6] border border-[#101010] text-[#101010]">
            <span className="text-[#5F5E5E] block uppercase">14-DAY Z-SCORE</span>
            <span className="font-bold text-body-sm">
              {anomalyResult.numbers.z_score || 0}
            </span>
          </div>
        </div>
      )}

      <p className="font-label-meta text-label-meta text-[#101010] uppercase">
        POLICY SPEC: Store operations are never blocked. This issue will be recorded with an anomaly flag for audit tracking.
      </p>
    </div>
  );
};

export default AnomalyBanner;
