import React from "react";

export const ConfidenceField = ({ confidence, label, children }) => {
  if (confidence === undefined || confidence === null) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-[11px] font-mono uppercase tracking-wider text-[#101010] font-bold">
            {label}
          </label>
        )}
        {children}
      </div>
    );
  }

  const num = typeof confidence === "number" ? confidence : parseFloat(confidence) || 0;

  let badgeStyle = "bg-[#B3261E]/15 text-[#B3261E] border-[#B3261E]";
  let labelText = `${Math.round(num)}% LOW`;

  if (num >= 80) {
    badgeStyle = "bg-[#2F6F4E]/15 text-[#2F6F4E] border-[#2F6F4E]";
    labelText = `${Math.round(num)}% CONF`;
  } else if (num >= 60) {
    badgeStyle = "bg-[#FCBC18]/25 text-[#101010] border-[#FCBC18]";
    labelText = `${Math.round(num)}% REVIEW`;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-[11px] font-mono uppercase tracking-wider text-[#101010] font-bold">
            {label}
          </label>
        )}
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-none font-bold ${badgeStyle}`}
        >
          {labelText}
        </span>
      </div>
      {children}
    </div>
  );
};

