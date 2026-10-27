import React from "react";

export const BoqProgressBar = ({ delivered = 0, planned = 0, tolerancePct = 5, unit = "kg" }) => {
  const d = Number(delivered) || 0;
  const p = Number(planned) || 0;

  const pct = p > 0 ? (d / p) * 100 : 0;
  const toleranceLimit = p > 0 ? p * (1 + tolerancePct / 100) : 0;
  const isOver = d > toleranceLimit;
  const isWarning = d > p && !isOver;

  let barColor = "bg-[#2F6F4E]";
  let statusText = "NOMINAL";
  let textColor = "text-[#2F6F4E]";

  if (isOver) {
    barColor = "bg-[#B3261E]";
    statusText = `EXCEEDED (+${(pct - 100).toFixed(1)}%)`;
    textColor = "text-[#B3261E]";
  } else if (isWarning) {
    barColor = "bg-[#FCBC18]";
    statusText = `TOLERANCE (+${(pct - 100).toFixed(1)}%)`;
    textColor = "text-[#101010]";
  }

  const fillWidth = Math.min(Math.max(pct, 0), 100);

  return (
    <div className="space-y-1.5 w-full font-mono">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#101010] tabular-nums">
          <strong className="font-bold">{d.toLocaleString()}</strong> / {p.toLocaleString()} {unit}
        </span>
        <span className={`text-[10px] uppercase font-bold tracking-wider ${textColor}`}>
          {pct.toFixed(1)}% — {statusText}
        </span>
      </div>

      {/* Progress Track */}
      <div className="relative w-full h-2.5 bg-[#E6E2DD] border border-[#101010] rounded-none overflow-hidden">
        <div
          className={`h-full transition-none ${barColor}`}
          style={{ width: `${fillWidth}%` }}
        />
        {/* Tolerance marker */}
        {p > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[#B3261E] z-10"
            style={{ left: `${Math.min(100, 100 / (1 + tolerancePct / 100))}%` }}
            title={`Tolerance Limit: ${toleranceLimit.toLocaleString()} ${unit}`}
          />
        )}
      </div>
    </div>
  );
};

