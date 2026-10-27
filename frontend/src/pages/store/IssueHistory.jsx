import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchMaterialIssues, fetchStages, fetchMaterials } from "../../api/store";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const IssueHistory = () => {
  const { selectedProjectId } = useStoreProject();

  const [issues, setIssues] = useState([]);
  const [stages, setStages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [stageFilter, setStageFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadMeta() {
      try {
        const [stgs, mats] = await Promise.all([
          fetchStages(selectedProjectId),
          fetchMaterials(selectedProjectId),
        ]);
        setStages(stgs || []);
        setMaterials(mats || []);
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, [selectedProjectId]);

  const loadIssues = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const data = await fetchMaterialIssues(selectedProjectId, {
        stage_id: stageFilter || undefined,
        material_id: materialFilter || undefined,
      });
      setIssues(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [selectedProjectId, stageFilter, materialFilter]);

  return (
    <div className="space-y-6">
      {/* Top Architectural Header */}
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
                SPEC // DISPATCH-DRAWDOWN-LEDGER
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
              Material Issue Log
            </h2>
            <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
              IMMUTABLE CHRONOLOGICAL RECORD OF PHYSICAL MATERIALS DISPENSED TO MILESTONE STAGES
            </p>
          </div>

          <Link
            to="/store/issue"
            className="px-5 py-2.5 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code font-bold uppercase tracking-wider border border-[#101010] transition-colors shadow-[2px_2px_0px_#101010] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">output</span>
            <span>ISSUE MATERIAL</span>
          </Link>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="p-4 bg-[#F2ECE6] border border-[#101010] flex flex-wrap gap-4 items-center justify-between font-label-code text-label-code">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#5F5E5E] uppercase">FILTER BY:</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-[#E6E2DD] border border-[#101010] px-3 py-1.5 uppercase font-bold text-[#101010] outline-none"
          >
            <option value="">ALL STAGES</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                STAGE #{s.order}: {s.name}
              </option>
            ))}
          </select>

          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="bg-[#E6E2DD] border border-[#101010] px-3 py-1.5 uppercase font-bold text-[#101010] outline-none"
          >
            <option value="">ALL MATERIALS</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-[#5F5E5E] uppercase">
          {issues.length} DRAWDOWN ENTRIES
        </span>
      </div>

      {/* Issues Table */}
      {loading ? (
        <SkeletonLoader rows={5} type="table" />
      ) : issues.length === 0 ? (
        <div className="p-12 text-center bg-[#F2ECE6] border border-[#101010]">
          <span className="material-symbols-outlined text-4xl text-[#A39B8F] mb-2">
            history_toggle_off
          </span>
          <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
            NO MATERIAL DRAWDOWN RECORDS
          </h3>
          <p className="font-body-md text-body-md text-[#5F5E5E] mt-1">
            Logged issues to structural stages will appear here with automated anomaly check records.
          </p>
        </div>
      ) : (
        <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-md">
            <thead>
              <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">TIMESTAMP</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">MILESTONE STAGE</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">DISPENSED MATERIAL</th>
                <th className="py-3.5 px-4 text-right border-r border-[#A39B8F]/30">QUANTITY</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">RECIPIENT / FOREMAN</th>
                <th className="py-3.5 px-4 text-right">ANOMALY AUDIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
              {issues.map((it, idx) => (
                <tr
                  key={it.id}
                  className={`hover:bg-[#E6E2DD] transition-colors ${
                    idx % 2 === 0 ? "bg-[#F2ECE6]" : "bg-[#F2ECE6]/60"
                  }`}
                >
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 font-bold">
                    {new Date(it.issued_at).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 uppercase">
                    {it.stage_name || `Stage #${it.stage_id}`}
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 uppercase font-bold">
                    {it.material_name || `Material #${it.material_id}`}
                  </td>
                  <td className="py-4 px-4 text-right border-r border-[#A39B8F]/30 tabular-nums font-bold">
                    {Number(it.qty).toLocaleString()} {it.unit}
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 uppercase text-[#5F5E5E]">
                    {it.issued_to}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {it.is_anomalous ? (
                      <span className="px-2 py-0.5 bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a] font-bold uppercase text-xs">
                        ⚠️ ANOMALY ({it.anomaly_level || "ALERT"})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#93d5ad]/30 text-[#296a49] border border-[#296a49] font-bold uppercase text-xs">
                        ✓ NOMINAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-3 bg-[#E6E2DD] border-t border-[#A39B8F]/30 flex items-center justify-between font-label-meta text-label-meta text-[#5F5E5E] uppercase">
            <span>SHOWING {issues.length} ISSUE LOG ENTRIES</span>
            <span>AUDIT TRAIL // RECORD HASH LOCKED</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueHistory;
