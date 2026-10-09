import React from "react";

export const EmptyState = ({
  icon = "inventory_2",
  title = "NO LOGGED RECORDS DETECTED",
  description = "No items match current telemetry filter specifications or repository query.",
  actionLabel,
  onAction,
}) => {
  return (
    <div className="p-12 text-center border-2 border-dashed border-[#101010] bg-[#E6E2DD]/40 flex flex-col items-center justify-center space-y-3 rounded-none">
      <div className="w-12 h-12 bg-[#FCBC18] border-2 border-[#101010] flex items-center justify-center shadow-[2px_2px_0px_#101010]">
        <span className="material-symbols-outlined text-2xl text-[#101010]">{icon}</span>
      </div>
      <h4 className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-wider text-[#101010]">
        {title}
      </h4>
      <p className="font-['Archivo_Narrow'] text-xs text-[#6E675F] max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-[#101010] text-[#F2ECE6] hover:bg-[#FCBC18] hover:text-[#101010] font-mono text-xs uppercase tracking-wider font-bold border-2 border-[#101010] shadow-[2px_2px_0px_#101010] transition-none cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

