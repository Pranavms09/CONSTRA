import React from "react";

export const StatusBadge = ({ status }) => {
  const s = (status || "").toLowerCase();

  const configs = {
    confirmed: {
      bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
      dot: "bg-emerald-400",
      label: "Confirmed",
    },
    draft: {
      bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      dot: "bg-amber-400",
      label: "Needs Review",
    },
    processing: {
      bg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
      dot: "bg-blue-400 animate-pulse",
      label: "Processing OCR",
    },
    failed: {
      bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      dot: "bg-rose-400",
      label: "Failed",
    },
  };

  const current = configs[s] || {
    bg: "bg-slate-800 border-slate-700 text-slate-300",
    dot: "bg-slate-400",
    label: status || "Unknown",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-mono ${current.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
};
