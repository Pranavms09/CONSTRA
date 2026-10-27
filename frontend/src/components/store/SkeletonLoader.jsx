import React from "react";

export const SkeletonLoader = ({ rows = 4, type = "table" }) => {
  if (type === "card") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-28 bg-[#E6E2DD] border-2 border-[#101010] rounded-none p-4" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-10 bg-[#101010]/15 border-2 border-[#101010] rounded-none" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 bg-[#E6E2DD] border border-[#A39B8F] rounded-none" />
      ))}
    </div>
  );
};

