import React from "react";

export const SeverityTag = ({ severity }) => {
  const sev = (severity || "").toLowerCase();

  const configs = {
    high: {
      bg: "bg-red-500/15 border-red-500/30 text-red-400",
      label: "HIGH",
    },
    medium: {
      bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      label: "MEDIUM",
    },
    low: {
      bg: "bg-sky-500/15 border-sky-500/30 text-sky-400",
      label: "LOW",
    },
  };

  const current = configs[sev] || {
    bg: "bg-slate-800 border-slate-700 text-slate-300",
    label: (severity || "INFO").toUpperCase(),
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold tracking-wider border ${current.bg}`}
    >
      {current.label}
    </span>
  );
};
