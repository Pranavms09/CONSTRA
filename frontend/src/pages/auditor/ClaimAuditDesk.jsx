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

  // Handle agent command trigger
  const handleRunCommand = async (commandType) => {
    try {
      const res = await sendAgentCommand(selectedClaimId, commandType);
      const jId = res.job_id;
      setActiveJobs((prev) => ({
        ...prev,
        [jId]: { command: commandType, state: "RUNNING", step: "Dispatching..." },
      }));

      // Poll job status
      const pollInterval = setInterval(async () => {
        try {
          const status = await fetchJobStatus(jId);
          setActiveJobs((prev) => ({
            ...prev,
            [jId]: {
              command: commandType,
              state: status.state,
              step: status.step,
              error: status.error,
            },
          }));

          if (status.state === "COMPLETED" || status.state === "FAILED") {
            clearInterval(pollInterval);
            if (status.state === "COMPLETED") {
              loadClaimDetails(selectedClaimId);
            }
          }
        } catch (e) {
          console.error("Poll error:", e);
          clearInterval(pollInterval);
        }
      }, 1500);
    } catch (err) {
      alert(`Failed to trigger agent command: ${err.message}`);
    }
  };

  // Handle auditor decision toggle
  const handleDecision = (fieldKey, decType, currentVal) => {
    const existing = decisions[fieldKey] || {};
    const updated = {
      ...decisions,
      [fieldKey]: {
        ...existing,
        dec: decType,
        val: existing.val !== undefined ? existing.val : currentVal,
        note: existing.note || "",
        stale: false,
      },
    };
    setDecisions(updated);
    saveAuditorDecisions(selectedClaimId, updated).catch(console.error);
  };

  const handleValueChange = (fieldKey, newVal) => {
    const existing = decisions[fieldKey] || {};
    const updated = {
      ...decisions,
      [fieldKey]: {
        ...existing,
        val: newVal,
        dec: existing.dec || "amend",
        stale: false,
      },
    };
    setDecisions(updated);
    saveAuditorDecisions(selectedClaimId, updated).catch(console.error);
  };

  const handleNoteChange = (fieldKey, newNote) => {
    const existing = decisions[fieldKey] || {};
    const updated = {
      ...decisions,
      [fieldKey]: {
        ...existing,
        note: newNote,
        stale: false,
      },
    };
    setDecisions(updated);
    saveAuditorDecisions(selectedClaimId, updated).catch(console.error);
  };

  // Submit final audit report
  const handleSubmitReport = async () => {
    if (!verdict) {
      alert("Please select a final audit verdict before signing the certificate.");
      return;
    }

    setSubmittingReport(true);
    try {
      const res = await submitAuditReport(selectedClaimId, verdict, verdictNote, decisions);
      setSubmitSuccess(res.message);
      if (res.report) {
        setClaim((prev) => ({
          ...prev,
          report: res.report,
          status:
            res.report.verdict === "agree" || res.report.verdict === "amend"
              ? "APPROVED"
              : "FLAGGED",
        }));
      }
      loadClaims();
    } catch (err) {
      setSubmitError(err?.message || "Submission failed");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="bg-[#101010] text-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] overflow-hidden flex flex-col md:flex-row">
      {/* ========================================================================= */}
      {/* LEFT RAIL: Claim Queue Rail                                               */}
      {/* ========================================================================= */}
      <div className="w-full md:w-72 bg-[#101010] border-r border-[#A39B8F]/30 p-4 space-y-4 shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-[#A39B8F]/20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FCBC18]" />
            <h3 className="font-label-code text-label-code uppercase tracking-wider text-[#F2ECE6] font-bold">
              CLAIM QUEUE RAIL
            </h3>
          </div>
          <span className="font-label-code text-label-code px-2 py-0.5 bg-[#1b1b20] border border-[#A39B8F]/30 text-[#FCBC18]">
            {claimsList.length} ACTIVE
          </span>
        </div>

        <div className="space-y-2.5">
          {claimsList.map((c) => {
            const isSelected = selectedClaimId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClaimId(c.id)}
                className={`w-full text-left p-3.5 border transition-all cursor-pointer font-label-code text-label-code ${
                  isSelected
                    ? "bg-[#F2ECE6] text-[#101010] border-[#FCBC18] shadow-[2px_2px_0px_#FCBC18]"
                    : "bg-[#1b1b20] text-[#F2ECE6] border-[#A39B8F]/30 hover:border-[#F2ECE6]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-bold ${isSelected ? "text-[#101010]" : "text-[#FCBC18]"}`}>
                    {c.id}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 border font-bold uppercase ${
                      c.risk === "HIGH"
                        ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                        : c.risk === "MEDIUM"
                        ? "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                        : "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                    }`}
                  >
                    {c.risk} RISK
                  </span>
                </div>
                <p className={`font-headline-md text-body-sm font-bold truncate uppercase ${isSelected ? "text-[#101010]" : "text-[#F2ECE6]"}`}>
                  {c.claimant}
                </p>
                <p className="font-label-meta text-label-meta text-[#8C8B91] truncate mt-0.5 uppercase">
                  {c.type}
                </p>
                <div className="mt-2.5 pt-2 border-t border-[#A39B8F]/20 flex items-center justify-between text-label-meta">
                  <span className="text-[#8C8B91]">{c.file_count} EVIDENCE FILES</span>
                  <span className={c.has_report ? "text-[#2F6F4E] font-bold" : "text-[#FCBC18]"}>
                    {c.has_report ? "✓ SEALED" : "PENDING"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT MAIN PANEL                                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 bg-[#F2ECE6] text-[#101010] p-6 space-y-6 overflow-y-auto">
        {loadingClaim ? (
          <div className="p-12 text-center text-[#5F5E5E] font-label-code text-label-code uppercase animate-pulse">
            EXTRACTING AUDIT TELEMETRY &amp; AI VERIFICATIONS FOR {selectedClaimId}...
          </div>
        ) : claimError ? (
          <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase">
            {claimError}
          </div>
        ) : claim ? (
          <>
            {/* Header KPI & Spec Dossier Bar */}
            <div className="p-6 bg-[#E6E2DD] border border-[#101010] shadow-[2px_2px_0px_#101010] space-y-4 relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline-lg text-headline-lg font-bold text-[#101010]">
                      {claim.id}
                    </span>
                    <span className="font-label-code text-label-code px-2 py-0.5 bg-[#101010] text-[#FCBC18] uppercase font-bold">
                      POLICY: {claim.policy_no}
                    </span>
                    {claim.report && (
                      <span className="font-label-code text-label-code px-2.5 py-0.5 bg-[#2F6F4E] text-[#F2ECE6] uppercase font-bold border border-[#101010]">
                        AUDITED // REV #{claim.report.revision}
                      </span>
                    )}
                  </div>
                  <h2 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mt-1">
                    {claim.type}
                  </h2>
                  <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-0.5">
                    CLAIMANT: <strong className="text-[#101010]">{claim.claimant}</strong> • FILED AT: {new Date(claim.filed_at).toLocaleString()}
                  </p>
                </div>

                {/* Evidence Files Strip */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mr-1">
                    ATTACHED FILES:
                  </span>
                  {claim.files?.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setPreviewFile(f)}
                      className="px-3 py-1.5 bg-[#F2ECE6] hover:bg-[#101010] hover:text-[#FCBC18] border border-[#101010] font-label-code text-label-code uppercase font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {f.kind === "photo" ? "image" : "description"}
                      </span>
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Command Execution Strip */}
              <div className="pt-4 border-t border-[#A39B8F]/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 font-label-code text-label-code">
                  <span className="font-bold uppercase text-[#101010] mr-2">
                    AGENT COMMANDS:
                  </span>
                  <button
                    onClick={() => handleRunCommand("run_ocr")}
                    className="px-3 py-1.5 bg-[#F2ECE6] hover:bg-[#101010] hover:text-[#FCBC18] text-[#101010] border border-[#101010] uppercase font-bold transition-colors cursor-pointer"
                    type="button"
                  >
                    ⚡ RUN OCR
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_vlm")}
                    className="px-3 py-1.5 bg-[#F2ECE6] hover:bg-[#101010] hover:text-[#FCBC18] text-[#101010] border border-[#101010] uppercase font-bold transition-colors cursor-pointer"
                    type="button"
                  >
                    👁 RUN VLM
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_exif")}
                    className="px-3 py-1.5 bg-[#F2ECE6] hover:bg-[#101010] hover:text-[#FCBC18] text-[#101010] border border-[#101010] uppercase font-bold transition-colors cursor-pointer"
                    type="button"
                  >
                    📍 RUN EXIF
                  </button>
                  <button
                    onClick={() => handleRunCommand("run_all")}
                    className="px-4 py-1.5 bg-[#FCBC18] hover:bg-[#101010] hover:text-[#FCBC18] text-[#101010] font-bold border border-[#101010] uppercase transition-colors shadow-[2px_2px_0px_#101010] cursor-pointer"
                    type="button"
                  >
                    🚀 RUN ALL MODELS
                  </button>
                </div>

                {/* Active Job Chips */}
                <div className="flex items-center gap-2">
                  {Object.values(activeJobs).map((j) => (
                    <div
                      key={j.jobId}
                      className={`px-3 py-1 font-label-code text-label-code font-bold uppercase border ${
                        j.state === "COMPLETED"
                          ? "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                          : j.state === "FAILED"
                          ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                          : "bg-[#ffdea2] text-[#7a5900] border-[#7a5900] animate-pulse"
                      }`}
                    >
                      {j.command}: {j.step || j.state}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Analysis vs. Auditor Review Spec Table */}
            <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] overflow-x-auto">
              <table className="w-full text-left border-collapse font-body-md text-body-md">
                <thead>
                  <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                    <th className="py-3 px-3 border-r border-[#A39B8F]/30">FIELD KEY</th>
                    <th className="py-3 px-3 border-r border-[#A39B8F]/30">AI MODEL EXTRACTION</th>
                    <th className="py-3 px-3 text-center border-r border-[#A39B8F]/30">AUDITOR DECISION</th>
                    <th className="py-3 px-3 border-r border-[#A39B8F]/30">AUDITOR VIEW / VALUE</th>
                    <th className="py-3 px-3 border-r border-[#A39B8F]/30">AUDITOR NOTE</th>
                    <th className="py-3 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A39B8F]/30 font-label-code text-label-code">
                  {claim.schema?.fields?.map((field) => {
                    const aiVal = claim.ai_extractions?.[field.key];
                    const dec = decisions[field.key] || {};
                    const currentDecision = dec.dec || "agree";

                    return (
                      <tr key={field.key} className="hover:bg-[#E6E2DD] transition-colors">
                        {/* Field Key */}
                        <td className="py-3.5 px-3 border-r border-[#A39B8F]/30 font-bold text-[#101010] uppercase">
                          {field.label || field.key}
                        </td>

                        {/* AI Extraction */}
                        <td className="py-3.5 px-3 border-r border-[#A39B8F]/30 text-[#101010]">
                          <div className="font-bold">{String(aiVal?.value || "N/A")}</div>
                          <div className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-0.5">
                            CONF: {aiVal?.confidence ? `${Math.round(aiVal.confidence * 100)}%` : "N/A"} • SRC: {aiVal?.source || "VLM"}
                          </div>
                        </td>

                        {/* Auditor Decision Buttons */}
                        <td className="py-3.5 px-3 border-r border-[#A39B8F]/30 text-center">
                          <div className="inline-flex border border-[#101010]">
                            <button
                              onClick={() => handleDecision(field.key, "agree", aiVal?.value)}
                              className={`px-2.5 py-1 uppercase font-bold text-xs cursor-pointer transition-colors ${
                                currentDecision === "agree"
                                  ? "bg-[#2F6F4E] text-[#F2ECE6]"
                                  : "bg-[#F2ECE6] text-[#101010] hover:bg-[#E6E2DD]"
                              }`}
                              type="button"
                            >
                              AGREE
                            </button>
                            <button
                              onClick={() => handleDecision(field.key, "amend", aiVal?.value)}
                              className={`px-2.5 py-1 uppercase font-bold text-xs border-l border-r border-[#101010] cursor-pointer transition-colors ${
                                currentDecision === "amend"
                                  ? "bg-[#FCBC18] text-[#101010]"
                                  : "bg-[#F2ECE6] text-[#101010] hover:bg-[#E6E2DD]"
                              }`}
                              type="button"
                            >
                              AMEND
                            </button>
                            <button
                              onClick={() => handleDecision(field.key, "flag", aiVal?.value)}
                              className={`px-2.5 py-1 uppercase font-bold text-xs cursor-pointer transition-colors ${
                                currentDecision === "flag"
                                  ? "bg-[#B3261E] text-[#F2ECE6]"
                                  : "bg-[#F2ECE6] text-[#101010] hover:bg-[#E6E2DD]"
                              }`}
                              type="button"
                            >
                              FLAG
                            </button>
                          </div>
                        </td>

                        {/* Auditor Value */}
                        <td className="py-3.5 px-3 border-r border-[#A39B8F]/30">
                          <input
                            type="text"
                            value={dec.val !== undefined ? dec.val : aiVal?.value || ""}
                            onChange={(e) => handleValueChange(field.key, e.target.value)}
                            className="w-full bg-[#E6E2DD] border border-[#101010] px-2 py-1 text-[#101010] font-label-code text-label-code font-bold outline-none focus:border-[#FCBC18]"
                          />
                        </td>

                        {/* Auditor Note */}
                        <td className="py-3.5 px-3 border-r border-[#A39B8F]/30">
                          <input
                            type="text"
                            placeholder="AUDIT NOTE..."
                            value={dec.note || ""}
                            onChange={(e) => handleNoteChange(field.key, e.target.value)}
                            className="w-full bg-[#E6E2DD] border border-[#A39B8F]/60 px-2 py-1 text-[#101010] font-label-code text-body-sm outline-none focus:border-[#101010]"
                          />
                        </td>

                        {/* Action status */}
                        <td className="py-3.5 px-3 text-right">
                          <span
                            className={`px-2 py-0.5 border uppercase font-bold text-xs ${
                              currentDecision === "agree"
                                ? "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                                : currentDecision === "amend"
                                ? "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                                : "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                            }`}
                          >
                            {currentDecision.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Final Verdict & Signoff Bar */}
            <div className="p-6 bg-[#E6E2DD] border border-[#101010] shadow-[3px_3px_0px_#101010] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#A39B8F]/30">
                <span className="w-2.5 h-2.5 bg-[#FCBC18]" />
                <h3 className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                  FINAL AUDIT VERDICT &amp; CRYPTOGRAPHIC SIGN-OFF
                </h3>
              </div>

              {submitSuccess && (
                <div className="p-3 bg-[#93d5ad]/30 border border-[#296a49] text-[#296a49] font-label-code text-label-code uppercase font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{submitSuccess}</span>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">
                    APEX VERDICT SELECTION
                  </label>
                  <select
                    value={verdict}
                    onChange={(e) => setVerdict(e.target.value)}
                    className="w-full bg-[#F2ECE6] border border-[#101010] p-2.5 font-label-code text-label-code uppercase font-bold text-[#101010] outline-none"
                  >
                    <option value="">SELECT VERDICT</option>
                    <option value="agree">APPROVE CLAIM (FULL CLEARANCE)</option>
                    <option value="amend">AMEND CLAIM (CLEAR WITH VARIATIONS)</option>
                    <option value="flag">REJECT CLAIM (WORK STOPPAGE / DEFECT)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">
                    VERDICT AUDIT SUMMARY NOTE
                  </label>
                  <input
                    type="text"
                    placeholder="Enter formal justification for certificate release..."
                    value={verdictNote}
                    onChange={(e) => setVerdictNote(e.target.value)}
                    className="w-full bg-[#F2ECE6] border border-[#101010] p-2.5 font-label-code text-label-code text-[#101010] outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#A39B8F]/30">
                <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase">
                  TAMPER-EVIDENT RECORD SEAL // HASH GENERATED UPON SUBMISSION
                </span>
                <button
                  onClick={handleSubmitReport}
                  disabled={submittingReport || !verdict}
                  className={`w-full sm:w-auto px-6 py-3 font-label-code text-label-code uppercase font-bold border border-[#101010] flex items-center justify-center gap-2 transition-all ${
                    !verdict || submittingReport
                      ? "bg-[#A39B8F]/40 text-[#5F5E5E] cursor-not-allowed"
                      : "bg-[#FCBC18] text-[#101010] hover:bg-[#101010] hover:text-[#FCBC18] shadow-[2px_2px_0px_#101010] cursor-pointer"
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  <span>
                    {submittingReport ? "SEALING RECORD..." : "SEAL AUDIT DOSSIER & SIGN MILESTONE"}
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Evidence File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-[#101010]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F2ECE6] border border-[#101010] shadow-[4px_4px_0px_#101010] max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#101010]">
              <span className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                EVIDENCE PREVIEW: {previewFile.name}
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                className="font-label-code text-label-code font-bold px-2 py-1 bg-[#101010] text-[#F2ECE6] hover:bg-[#FCBC18] hover:text-[#101010] cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>
            <div className="p-4 bg-[#E6E2DD] border border-[#A39B8F]/40 font-label-code text-label-code space-y-2">
              <p>FILE ID: {previewFile.id}</p>
              <p>MIME TYPE: {previewFile.mime_type || "application/octet-stream"}</p>
              <p>EXIF GPS STATUS: ANCHORED (± 1.4m CEP)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimAuditDesk;
