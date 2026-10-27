import React from "react";

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101010]/80">
      <div className="bg-[#F2ECE6] border-2 border-[#101010] shadow-[6px_6px_0px_#101010] max-w-lg w-full rounded-none overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Title Bar */}
        <div className="bg-[#101010] text-[#F2ECE6] px-4 py-2.5 flex items-center justify-between border-b-2 border-[#101010]">
          <span className="font-['Space_Grotesk'] text-xs uppercase tracking-wider font-bold">
            {title}
          </span>
          <span className="font-mono text-[10px] text-[#A39B8F]">ISO-19650 SPEC</span>
        </div>

        <div className="p-6 space-y-4 font-['Archivo_Narrow']">
          {message && (
            <p className="text-xs text-[#101010] leading-relaxed font-mono">
              {message}
            </p>
          )}
          {children}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#A39B8F]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold text-[#101010] bg-[#E6E2DD] hover:bg-[#d8d4cf] border-2 border-[#101010] rounded-none shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold rounded-none border-2 border-[#101010] shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer disabled:opacity-50 ${
                isDanger
                  ? "bg-[#B3261E] hover:bg-[#921f18] text-white"
                  : "bg-[#FCBC18] hover:bg-[#e5aa16] text-[#101010]"
              }`}
            >
              {isLoading ? "EXECUTING..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

