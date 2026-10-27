import React from "react";

export const Toast = ({ message, type = "success", onClose }) => {
  if (!message) return null;

  const isError = type === "error";
  const bg = isError
    ? "bg-[#B3261E] text-white border-[#101010]"
    : "bg-[#2F6F4E] text-[#F2ECE6] border-[#101010]";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-center gap-3 px-4 py-3 border-2 shadow-[4px_4px_0px_#101010] rounded-none font-mono text-xs uppercase tracking-wider ${bg}`}
      >
        <span className="font-bold text-sm">{isError ? "⚠" : "✓"}</span>
        <span className="font-semibold">{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 text-white/80 hover:text-white font-bold cursor-pointer"
          >
            [CLOSE]
          </button>
        )}
      </div>
    </div>
  );
};

