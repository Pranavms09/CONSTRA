import React, { useState, useEffect } from "react";
import {
  fetchClaims,
  fetchClaim,
  sendAgentCommand,
  fetchJobStatus,
  saveAuditorDecisions,
  submitAuditReport,
} from "../../api/client";

export const ClaimAuditDesk = () => {
  const [claimsList, setClaimsList] = useState([]);
  const [selectedClaimId, setSelectedClaimId] = useState("CLM-2026-001");
  const [claim, setClaim] = useState(null);
  const [loadingClaim, setLoadingClaim] = useState(false);
  const [claimError, setClaimError] = useState(null);

  // Agent command state
  const [activeJobs, setActiveJobs] = useState({}); // { job_123: { command, state, step } }

  // Auditor decision state per field { fieldKey: { dec: 'agree'|'amend'|'flag', val, note, stale } }
  const [decisions, setDecisions] = useState({});

  // End of report verdict state
  const [verdict, setVerdict] = useState("");
  const [verdictNote, setVerdictNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Evidence modal state
  const [previewFile, setPreviewFile] = useState(null);

  // Load claims list
  const loadClaims = async () => {
    try {
      const data = await fetchClaims();
      setClaimsList(data);
    } catch (err) {
      console.error("Failed to load claims list:", err);
    }
  };

  // Load selected claim
  const loadClaimDetails = async (id) => {
    setLoadingClaim(true);
    setClaimError(null);
    setSubmitSuccess(null);
    setSubmitError(null);
    try {
      const data = await fetchClaim(id);
      setClaim(data);
      setDecisions(data.decisions || {});
      if (data.report) {
        setVerdict(data.report.verdict);
        setVerdictNote(data.report.verdict_note || "");
      } else {
        setVerdict("");
        setVerdictNote("");
      }
    } catch (err) {
      setClaimError(err?.message || "Failed to load claim details");
    } finally {
      setLoadingClaim(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  useEffect(() => {
    if (selectedClaimId) {
      loadClaimDetails(selectedClaimId);
    }
  }, [selectedClaimId]);

  // Dispatch agent command
  const handleRunCommand = async (commandName, params = null) => {
    if (!selectedClaimId) return;
    try {
      const res = await sendAgentCommand(selectedClaimId, commandName, params);
      const jobId = res.jobId;
      setActiveJobs((prev) => ({
        ...prev,
        [jobId]: { jobId, command: commandName, state: "running", step: "Queued in agent bridge..." },
      }));
      pollJobStatus(jobId);
    } catch (err) {
      alert("Failed to send agent command: " + err.message);
    }
  };

  // Poll job status
  const pollJobStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const job = await fetchJobStatus(jobId);
        setActiveJobs((prev) => ({
          ...prev,
          [jobId]: job,
        }));
        if (job.state === "succeeded" || job.state === "failed") {
          clearInterval(interval);
          // Reload claim to get fresh extractions & updated stale markers
          loadClaimDetails(selectedClaimId);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1000);
  };

  // Update per-field auditor decision
  const handleDecisionChange = (fieldKey, decType, newVal = null, newNote = null) => {
    setDecisions((prev) => {
      const existing = prev[fieldKey] || { dec: "", val: "", note: "", stale: false };
      const updated = {
        ...existing,
        dec: decType,
        stale: false, // clear stale status on auditor interaction
      };
      if (newVal !== null) updated.val = newVal;
      if (newNote !== null) updated.note = newNote;

      const nextState = { ...prev, [fieldKey]: updated };
      saveAuditorDecisions(selectedClaimId, nextState).catch(console.error);
      return nextState;
    });
  };

  // Summary counts
  const decisionValues = Object.values(decisions);
  const agreeCount = decisionValues.filter((d) => d.dec === "agree").length;
  const amendCount = decisionValues.filter((d) => d.dec === "amend").length;
  const flagCount = decisionValues.filter((d) => d.dec === "flag").length;
  const staleCount = decisionValues.filter((d) => d.stale).length;

  const aiPayable = claim?.ai?.stated_total?.value || 0;
  const auditorPayableDecision = decisions["stated_total"]?.dec === "amend" ? decisions["stated_total"]?.val : aiPayable;

  // Submit Report
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!verdict) {
      setSubmitError("Please select a final verdict for this claim.");
      return;
    }

    setSubmittingReport(true);
    try {
      const res = await submitAuditReport(selectedClaimId, verdict, verdictNote, decisions);
      setSubmitSuccess(res.message);
      if (res.report) {
        setClaim((prev) => ({ ...prev, report: res.report, status: res.report.verdict === "agree" || res.report.verdict === "amend" ? "APPROVED" : "FLAGGED" }));
      }
      loadClaims();
    } catch (err) {
      setSubmitError(err?.message || "Submission failed");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden flex flex-col md:flex-row">
      {/* LEFT RAIL: Claim Queue */}
      <div className="w-full md:w-64 bg-slate-900/80 border-r border-slate-800 p-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Claim Queue Rail</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {claimsList.length} Active
          </span>
        </div>

        <div className="space-y-2">
          {claimsList.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClaimId(c.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                selectedClaimId === c.id
                  ? "bg-slate-800 border-amber-500/50 text-white shadow-lg"
                  : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-amber-400">{c.id}</span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                    c.risk === "HIGH"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : c.risk === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {c.risk}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-200 truncate">{c.claimant}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.type}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>{c.file_count} Files</span>
                <span className={c.has_report ? "text-emerald-400" : "text-amber-400"}>
                  {c.has_report ? "✓ Report SHA-256" : "Pending Review"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN PANEL */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {loadingClaim ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs animate-pulse">
            Loading Claim Audit Desk data for {selectedClaimId}...
          </div>
        ) : claimError ? (
          <div className="p-6 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
            {claimError}
          </div>
        ) : claim ? (
          <>
            {/* Header KPI & Agent Command Bar */}
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-white">{claim.id}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {claim.policy_no}
                    </span>
                    {claim.report && (
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        AUDITED (Rev #{claim.report.revision})
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">{claim.type}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Claimant: <span className="text-slate-200 font-medium">{claim.claimant}</span> • Filed: {new Date(claim.filed_at).toLocaleString()}
                  </p>
                </div>

                {/* Evidence Files Strip */}
                <div className="flex items-center gap-2">
                  {claim.files?.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setPreviewFile(f)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{f.kind === "photo" ? "📸" : "📄"}</span>
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Command Bar */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent Commands:</span>
                  <button
                    onClick={() => handleRunCommand("run_ocr")}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    ⚡ Run OCR
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_vlm")}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    👁️ Run VLM
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_exif")}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    📍 Run EXIF
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_all")}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    🚀 Run All Models
                  </button>
                </div>

                {/* Active Job Chips */}
                <div className="flex items-center gap-2">
                  {Object.values(activeJobs).map((j) => (
                    <div
                      key={j.jobId}
                      className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 border ${
                        j.state === "running"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : j.state === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-red-500/10 text-red-300 border-red-500/30"
                      }`}
                    >
                      {j.state === "running" && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                      <span>{j.command}:</span>
                      <span className="font-semibold">{j.step || j.state}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI vs Auditor Comparison Grid */}
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">AI Analysis vs. Auditor Review Grid</h3>
                  <p className="text-xs text-slate-400">
                    Review every extracted model parameter. Select Agree, Amend, or Flag and record auditor notes.
                  </p>
                </div>
                {staleCount > 0 && (
                  <div className="px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold animate-pulse">
                    ⚠️ {staleCount} Field(s) Marked Stale (Re-review required)
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 w-48">Field Key</th>
                      <th className="px-4 py-3 w-64">AI Model Extraction</th>
                      <th className="px-4 py-3 w-32">Auditor Decision</th>
                      <th className="px-4 py-3">Auditor View / Value</th>
                      <th className="px-4 py-3">Auditor Note</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {Object.entries(claim.ai || {}).map(([key, item]) => {
                      const d = decisions[key] || { dec: "", val: "", note: "", stale: false };
                      return (
                        <tr
                          key={key}
                          className={`hover:bg-slate-800/30 ${
                            d.stale ? "bg-amber-950/20 border-l-4 border-l-amber-500" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-white block">{key}</span>
                            {d.stale && (
                              <span className="text-[10px] font-mono text-amber-400 block font-semibold mt-0.5">
                                ⚠️ Model output changed (Stale)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-white text-sm font-semibold">
                              {typeof item.value === "number" ? `₹${item.value.toLocaleString()}` : String(item.value)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px]">
                              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                                {item.source}
                              </span>
                              <span className="text-emerald-400">{(item.confidence * 100).toFixed(0)}% conf</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDecisionChange(key, "agree", item.value)}
                                className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors border ${
                                  d.dec === "agree"
                                    ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                }`}
                              >
                                Agree
                              </button>
                              <button
                                onClick={() => handleDecisionChange(key, "amend", d.val || item.value)}
                                className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors border ${
                                  d.dec === "amend"
                                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                }`}
                              >
                                Amend
                              </button>
                              <button
                                onClick={() => handleDecisionChange(key, "flag", item.value)}
                                className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors border ${
                                  d.dec === "flag"
                                    ? "bg-red-500 text-slate-950 border-red-400 font-bold"
                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                }`}
                              >
                                Flag
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {d.dec === "amend" ? (
                              <input
                                type="text"
                                value={d.val !== undefined ? d.val : item.value}
                                onChange={(e) => handleDecisionChange(key, "amend", e.target.value)}
                                className="w-full px-2.5 py-1 rounded bg-slate-950 border border-amber-500 text-white font-mono text-xs focus:outline-none"
                              />
                            ) : (
                              <span className="font-mono text-slate-400 text-xs">
                                {d.dec ? String(d.val ?? item.value) : "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              placeholder={d.dec === "amend" || d.dec === "flag" ? "Mandatory note..." : "Optional note..."}
                              value={d.note || ""}
                              onChange={(e) => handleDecisionChange(key, d.dec, d.val, e.target.value)}
                              className={`w-full px-2.5 py-1 rounded bg-slate-950 border text-xs focus:outline-none ${
                                (d.dec === "amend" || d.dec === "flag") && !d.note?.trim()
                                  ? "border-red-500/80 text-white"
                                  : "border-slate-800 text-slate-300"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRunCommand("rerun_field", { fieldKey: key })}
                              className="px-2 py-1 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                            >
                              ↻ Re-run
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculation & Geofence Verification Checks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  🧮 Math & Line-Item Check
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded bg-slate-950">
                    <span className="text-slate-400">Stated Total (AI OCR):</span>
                    <span className="text-white font-bold">₹{(claim.ai?.stated_total?.value || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-slate-950">
                    <span className="text-slate-400">Line Items Sum:</span>
                    <span className="text-emerald-400 font-bold">₹50,622</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-amber-500/30 text-amber-300">
                    <span>Unvouched Invoice Gap:</span>
                    <span className="font-bold">₹1,700</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  📍 Geofence & EXIF Verification
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded bg-slate-950">
                    <span className="text-slate-400">Configured Site Radius:</span>
                    <span className="text-white font-bold">200 metres</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-slate-950 border border-red-500/30 text-red-300">
                    <span>Photo Distance From Site:</span>
                    <span className="font-bold">1,770 metres (1.77 km)</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-slate-950">
                    <span className="text-slate-400">EXIF Software Tag:</span>
                    <span className="text-slate-300">Adobe Photoshop 2024</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 6: END-OF-REPORT VERDICT & SIGN-OFF */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">Section 6: Final Auditor Verdict & Sign-Off</h3>
                  <p className="text-xs text-slate-400">
                    Record your overall audit conclusion. Your verdict, summary note, and field decision hash will be locked with SHA-256.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-emerald-500/30 text-emerald-400">
                    ✓ {agreeCount} Agree
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-amber-500/30 text-amber-400">
                    ✎ {amendCount} Amend
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-red-500/30 text-red-400">
                    🚩 {flagCount} Flag
                  </span>
                </div>
              </div>

              {/* Verdict Option Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    id: "agree",
                    title: "Agree",
                    desc: "Accept AI assessment as is",
                    color: "border-emerald-500 text-emerald-400",
                    allowed: amendCount === 0 && flagCount === 0,
                  },
                  {
                    id: "amend",
                    title: "Agree with Amendments",
                    desc: "Accept with corrected field values",
                    color: "border-amber-500 text-amber-400",
                    allowed: amendCount > 0,
                  },
                  {
                    id: "disagree",
                    title: "Disagree",
                    desc: "Reject overall AI assessment",
                    color: "border-red-500 text-red-400",
                    allowed: true,
                  },
                  {
                    id: "flag",
                    title: "Flag for Escalation",
                    desc: "Escalate to Senior Fraud Desk",
                    color: "border-purple-500 text-purple-400",
                    allowed: true,
                  },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVerdict(v.id)}
                    disabled={!v.allowed}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      verdict === v.id
                        ? `bg-slate-950 ${v.color} shadow-lg ring-2 ring-amber-400`
                        : v.allowed
                        ? "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                        : "bg-slate-950/30 border-slate-900 text-slate-600 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="font-bold text-sm font-mono flex items-center justify-between">
                      <span>{v.title}</span>
                      {verdict === v.id && <span>✓</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{v.desc}</p>
                  </button>
                ))}
              </div>

              {/* Verdict Summary Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Auditor Verdict Rationale & Summary Note
                </label>
                <textarea
                  rows={3}
                  value={verdictNote}
                  onChange={(e) => setVerdictNote(e.target.value)}
                  placeholder="Provide detailed justification for your audit decision..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Submission Feedback */}
              {submitError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono space-y-1">
                  <div className="font-bold text-emerald-400">✓ Audit Report Submitted Successfully:</div>
                  <p>{submitSuccess}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs font-mono text-slate-400">
                  AI Payable: <span className="text-white">₹{aiPayable.toLocaleString()}</span> • Auditor Payable:{" "}
                  <span className="text-emerald-400 font-bold">₹{auditorPayableDecision.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleSubmitReport}
                  disabled={submittingReport || staleCount > 0}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingReport ? "Hashing & Submitting..." : "🔒 Sign & Submit Audit Report (SHA-256)"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* EVIDENCE FILE PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <span>{previewFile.kind === "photo" ? "📸" : "📄"}</span>
                <span>{previewFile.name}</span>
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="bg-slate-950 p-8 rounded-xl text-center border border-slate-800 space-y-3">
              {previewFile.kind === "photo" ? (
                <div className="space-y-2">
                  <div className="w-full h-48 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 font-mono text-xs text-amber-400">
                    [Photo Preview: column_casting.jpg - 1.77km Geofence Discrepancy]
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    EXIF Metadata: Captured 2026-10-08 14:22 UTC • Device: iPhone 14 Pro • Lat: 12.9862 N, Lon: 77.6080 E
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full h-48 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 font-mono text-xs text-emerald-400">
                    [Document OCR Bounding Box: column_casting_invoice.pdf]
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Extracted text region: Stated Total = ₹52,322 • Line Items Sum = ₹50,622 (Unvouched gap ₹1,700)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
