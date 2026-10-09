import React from "react";

export const ConfidenceField = ({ confidence, label, children }) => {
  if (confidence === undefined || confidence === null) {
    return (
      <div className="space-y-1">
        {label && <label className="block text-xs font-medium text-slate-300">{label}</label>}
        {children}
      </div>
    );
  }

  const num = typeof confidence === "number" ? confidence : parseFloat(confidence) || 0;

  let badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  let labelText = `${Math.round(num)}% (Low Confidence)`;

  if (num >= 80) {
    badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    labelText = `${Math.round(num)}% Confidence`;
  } else if (num >= 60) {
    badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/40";
    labelText = `${Math.round(num)}% (Review Advised)`;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {label && <label className="block text-xs font-medium text-slate-300">{label}</label>}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeStyle}`}>
          {labelText}
        </span>
      </div>
      {children}
    </div>
  );
};
