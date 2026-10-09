import React from "react";

export const ReconcileTable = ({ items = [] }) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-400">
        No reconciliation data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
          <tr>
            <th className="py-2.5 px-4">Material</th>
            <th className="py-2.5 px-4 text-right">Total Delivered</th>
            <th className="py-2.5 px-4 text-right">BOQ Planned</th>
            <th className="py-2.5 px-4 text-right">Variance</th>
            <th className="py-2.5 px-4 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-mono">
          {items.map((row, idx) => {
            const isOver = row.status === "over";
            const isOk = row.status === "ok";
            const varianceSign = row.variance_pct > 0 ? "+" : "";

            return (
              <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                <td className="py-3 px-4 font-sans font-medium text-white">
                  {row.material_name}
                </td>
                <td className="py-3 px-4 text-right text-slate-200">
                  {Number(row.delivered).toLocaleString()} {row.base_unit}
                </td>
                <td className="py-3 px-4 text-right text-slate-400">
                  {Number(row.planned).toLocaleString()} {row.base_unit}
                </td>
                <td
                  className={`py-3 px-4 text-right font-semibold ${
                    isOver
                      ? "text-rose-400"
                      : isOk
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {varianceSign}{Number(row.variance_pct).toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      isOver
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : isOk
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
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
