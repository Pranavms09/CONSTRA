import React from "react";

export const ReconcileTable = ({ items = [] }) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-6 text-xs font-mono text-[#6E675F] border border-[#101010] bg-white">
        NO RECONCILIATION TELEMETRY DATA RECORDED
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-[#101010] bg-white rounded-none">
      <table className="w-full text-left text-xs font-['Archivo_Narrow']">
        <thead className="bg-[#101010] text-[#F2ECE6] font-['Space_Grotesk'] text-[11px] uppercase tracking-wider border-b-2 border-[#101010]">
          <tr>
            <th className="py-2.5 px-3">Material Spec</th>
            <th className="py-2.5 px-3 text-right">Delivered</th>
            <th className="py-2.5 px-3 text-right">BOQ Target</th>
            <th className="py-2.5 px-3 text-right">Variance</th>
            <th className="py-2.5 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#A39B8F]/30 font-mono">
          {items.map((row, idx) => {
            const isOver = row.status === "over";
            const isOk = row.status === "ok";
            const varianceSign = row.variance_pct > 0 ? "+" : "";

            return (
              <tr key={idx} className="hover:bg-[#F2ECE6]/50">
                <td className="py-2.5 px-3 font-['Space_Grotesk'] font-bold text-[#101010]">
                  {row.material_name}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[#101010]">
                  {Number(row.delivered).toLocaleString()} {row.base_unit}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[#6E675F]">
                  {Number(row.planned).toLocaleString()} {row.base_unit}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                    isOver
                      ? "text-[#B3261E]"
                      : isOk
                      ? "text-[#2F6F4E]"
                      : "text-[#101010]"
                  }`}
                >
                  {varianceSign}{Number(row.variance_pct).toFixed(1)}%
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold border rounded-none ${
                      isOver
                        ? "bg-[#B3261E]/15 text-[#B3261E] border-[#B3261E]"
                        : isOk
                        ? "bg-[#2F6F4E]/15 text-[#2F6F4E] border-[#2F6F4E]"
                        : "bg-[#FCBC18]/30 text-[#101010] border-[#FCBC18]"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

