import React from "react";

export const Toast = ({ message, type = "success", onClose }) => {
  if (!message) return null;

  const isError = type === "error";
  const bg = isError ? "bg-rose-950/90 border-rose-500/50 text-rose-200" : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200";
  const icon = isError ? "✗" : "✓";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs backdrop-blur-md ${bg}`}>
        <span className="font-bold">{icon}</span>
        <span>{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 text-slate-400 hover:text-white text-sm"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};
