import React from "react";

export const AnomalyBanner = ({ anomalyResult }) => {
  if (!anomalyResult || !anomalyResult.is_anomalous) return null;

  const isAlert = anomalyResult.level === "alert";
  const bg = isAlert ? "bg-rose-950/40 border-rose-500/40" : "bg-amber-950/40 border-amber-500/40";
  const icon = isAlert ? "🚨" : "⚠️";
  const title = isAlert ? "High Consumption Anomaly Detected" : "Drawdown Warning";
  const textColor = isAlert ? "text-rose-300" : "text-amber-300";
  const badgeColor = isAlert ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300";

  return (
    <div className={`p-4 rounded-xl border ${bg} text-xs space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={`font-semibold ${textColor}`}>{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] uppercase ${badgeColor}`}>
          {anomalyResult.level}
        </span>
      </div>

      {anomalyResult.reasons && anomalyResult.reasons.length > 0 && (
        <ul className="list-disc list-inside space-y-1 text-slate-300">
          {anomalyResult.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {anomalyResult.numbers && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-900/60">
            <span className="text-slate-400 block text-[10px]">Verified Progress</span>
            <span className="text-white font-semibold">
              {(anomalyResult.numbers.verified_progress * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-2 rounded bg-slate-900/60">
            <span className="text-slate-400 block text-[10px]">Expected Limit</span>
            <span className="text-white font-semibold">
              {Number(anomalyResult.numbers.expected_for_progress || 0).toLocaleString()} kg
            </span>
          </div>
          <div className="p-2 rounded bg-slate-900/60">
            <span className="text-slate-400 block text-[10px]">Cumulative With This</span>
            <span className="text-rose-400 font-semibold">
              {Number(anomalyResult.numbers.cumulative_total || 0).toLocaleString()} kg
            </span>
          </div>
          <div className="p-2 rounded bg-slate-900/60">
            <span className="text-slate-400 block text-[10px]">14-Day Z-Score</span>
            <span className="text-white font-semibold">
              {anomalyResult.numbers.z_score || 0}
            </span>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 italic">
        ℹ️ <strong>Policy Notice:</strong> Store operations are never blocked. This issue will be recorded with an anomaly flag for audit tracking.
      </p>
    </div>
  );
};
