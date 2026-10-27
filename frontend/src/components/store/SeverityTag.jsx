import React from "react";

export const SeverityTag = ({ severity }) => {
  const sev = (severity || "").toLowerCase();

  const configs = {
    high: {
      bg: "bg-[#B3261E] text-[#F2ECE6] border-[#101010]",
      label: "CRITICAL",
    },
    critical: {
      bg: "bg-[#B3261E] text-[#F2ECE6] border-[#101010]",
      label: "CRITICAL",
    },
    medium: {
      bg: "bg-[#FCBC18] text-[#101010] border-[#101010]",
      label: "WARNING",
    },
    warning: {
      bg: "bg-[#FCBC18] text-[#101010] border-[#101010]",
      label: "WARNING",
    },
    low: {
      bg: "bg-[#E6E2DD] text-[#101010] border-[#A39B8F]",
      label: "INFO",
    },
  };

  const current = configs[sev] || {
    bg: "bg-[#E6E2DD] text-[#504533] border-[#827560]/30",
    label: (severity || "INFO").toUpperCase(),
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-none text-label-code font-label-code font-bold uppercase tracking-wider border select-none ${current.bg}`}
    >
      {current.label}
    </span>
  );
};

export default SeverityTag;
