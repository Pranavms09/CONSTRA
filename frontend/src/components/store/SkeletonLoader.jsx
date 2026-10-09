import React from "react";

export const SkeletonLoader = ({ rows = 4, type = "table" }) => {
  if (type === "card") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl p-4" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-10 bg-slate-900/80 border border-slate-800 rounded-xl" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-900/40 border border-slate-800/60 rounded-xl" />
      ))}
    </div>
  );
};
