import React from "react";

export const BoqProgressBar = ({ delivered = 0, planned = 0, tolerancePct = 5, unit = "kg" }) => {
  const d = Number(delivered) || 0;
  const p = Number(planned) || 0;

  const pct = p > 0 ? (d / p) * 100 : 0;
  const toleranceLimit = p > 0 ? p * (1 + tolerancePct / 100) : 0;
  const isOver = d > toleranceLimit;
  const isWarning = d > p && !isOver;

  let barColor = "bg-emerald-500";
  let statusText = "Within Plan";
  let textColor = "text-emerald-400";

  if (isOver) {
    barColor = "bg-rose-500";
    statusText = `Over BOQ (+${(pct - 100).toFixed(1)}%)`;
    textColor = "text-rose-400";
  } else if (isWarning) {
    barColor = "bg-amber-500";
    statusText = `Within Tolerance (+${(pct - 100).toFixed(1)}%)`;
    textColor = "text-amber-400";
  }

  const fillWidth = Math.min(Math.max(pct, 0), 100);

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-slate-300">
          <strong className="text-white">{d.toLocaleString()}</strong> / {p.toLocaleString()} {unit}
        </span>
        <span className={`font-mono text-[11px] font-semibold ${textColor}`}>
          {pct.toFixed(1)}% — {statusText}
        </span>
      </div>

      {/* Progress Track */}
      <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${fillWidth}%` }}
        />
        {/* Tolerance marker */}
        {p > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-10"
            style={{ left: `${Math.min(100, 100 / (1 + tolerancePct / 100))}%` }}
            title={`Tolerance Limit: ${toleranceLimit.toLocaleString()} ${unit}`}
          />
        )}
      </div>
    </div>
  );
};
