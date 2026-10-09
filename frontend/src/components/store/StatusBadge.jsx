import React from "react";

export const StatusBadge = ({ status }) => {
  const s = (status || "").toLowerCase();

  const configs = {
    confirmed: {
      bg: "bg-[#2F6F4E] text-[#F2ECE6] border-[#101010]",
      dot: "bg-[#F2ECE6]",
      label: "CONFIRMED",
    },
    draft: {
      bg: "bg-[#FCBC18] text-[#101010] border-[#101010]",
      dot: "bg-[#101010]",
      label: "NEEDS REVIEW",
    },
    processing: {
      bg: "bg-[#E6E2DD] text-[#101010] border-[#101010]",
      dot: "bg-[#FCBC18] animate-pulse",
      label: "PROCESSING OCR",
    },
    failed: {
      bg: "bg-[#B3261E] text-[#F2ECE6] border-[#101010]",
      dot: "bg-[#F2ECE6]",
      label: "FAILED",
    },
  };

  const current = configs[s] || {
    bg: "bg-[#E6E2DD] text-[#504533] border-[#827560]/30",
    dot: "bg-[#504533]",
    label: (status || "UNKNOWN").toUpperCase(),
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-label-code font-label-code uppercase font-bold border tracking-wider select-none ${current.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-none ${current.dot}`} />
      {current.label}
    </span>
  );
};

export default StatusBadge;
