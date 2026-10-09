import React from "react";

export const EmptyState = ({
  icon = "📦",
  title = "No records found",
  description = "No items match your criteria or none have been created yet.",
  actionLabel,
  onAction,
}) => {
  return (
    <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-2xl">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
