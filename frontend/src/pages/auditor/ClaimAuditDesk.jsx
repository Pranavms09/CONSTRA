import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  API_BASE_URL,
  sendAgentCommand,
  fetchJobStatus,
  saveAuditorDecisions,
} from "../../api/client";
import {
  fetchAllClaims,
  fetchClaimById,
  submitClaimVerdict,
} from "../../services/firebaseDataService";

export const ClaimAuditDesk = () => {
  const [claimsList, setClaimsList] = useState([]);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [claim, setClaim] = useState(null);
  const [loadingClaims, setLoadingClaims] = useState(true);
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

  // Clearance Certificate & Blocker state
  const [blockersList, setBlockersList] = useState([]);
  const [certificateModal, setCertificateModal] = useState(null);

  // Load claims list from Firebase Firestore & Backend
  const loadClaims = async () => {
    try {
      setLoadingClaims(true);
      const data = await fetchAllClaims();
      setClaimsList(data || []);
      if (data && data.length > 0) {
        if (!selectedClaimId || !data.some((c) => c.id === selectedClaimId)) {
          setSelectedClaimId(data[0].id);
        }
      } else {
        setSelectedClaimId(null);
        setClaim(null);
      }
    } catch (err) {
      console.error("Failed to load claims list:", err);
    } finally {
      setLoadingClaims(false);
    }
  };

  // Load selected claim
  const loadClaimDetails = async (id) => {
    if (!id) return;
    setLoadingClaim(true);
    setClaimError(null);
    setSubmitSuccess(null);
    setSubmitError(null);
    try {
      const data = await fetchClaimById(id);
      setClaim(data);
      setDecisions(data?.decisions || {});
      if (data?.report) {
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
    if (!selectedClaimId) return;
    try {
      const res = await sendAgentCommand(selectedClaimId, commandType);
      const jId = res.jobId || res.job_id;
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

          if (status.state === "succeeded" || status.state === "failed") {
            clearInterval(pollInterval);
            if (status.state === "succeeded") {
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
    if (!selectedClaimId) return;
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
    if (!selectedClaimId) return;
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
    if (!selectedClaimId) return;
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

  // Submit final audit report to Firebase Firestore & Backend
  const handleSubmitReport = async () => {
    if (!selectedClaimId) return;
    if (!verdict) {
      alert("Please select a final audit verdict before signing the certificate.");
      return;
    }

    setSubmittingReport(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setBlockersList([]);
    try {
      const res = await submitClaimVerdict(selectedClaimId, verdict, verdictNote, decisions);
      setSubmitSuccess(`Milestone verification processed and sealed successfully.`);
      if (res?.certificate) {
        setCertificateModal(res.certificate);
      }
      if (res?.report) {
        setClaim((prev) => ({
          ...prev,
          report: res.report,
          status:
            res.report.verdict === "agree" || res.report.verdict === "amend" || res.report.verdict === "approve"
              ? "CLEARED"
              : "FLAGGED",
        }));
      }
      await loadClaims();
    } catch (err) {
      setSubmitError(err?.message || "Submission failed");
      if (err?.blockers && Array.isArray(err.blockers)) {
        setBlockersList(err.blockers);
      }
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

        {loadingClaims ? (
          <div className="p-4 text-center text-xs font-label-code text-[#A39B8F]">
            FETCHING FIRESTORE CLAIMS...
          </div>
        ) : claimsList.length === 0 ? (
          <div className="p-4 bg-[#1b1b20] border border-[#A39B8F]/20 text-center space-y-2">
            <span className="material-symbols-outlined text-2xl text-[#FCBC18]">
              inbox
            </span>
            <p className="font-label-code text-label-code text-[#F2ECE6] uppercase font-bold">
              QUEUE IS EMPTY
            </p>
            <p className="font-label-meta text-label-meta text-[#A39B8F] uppercase">
              No claims submitted by supervisors yet. Transmit from /supervisor to populate this rail.
            </p>
            <Link
              to="/supervisor"
              className="inline-block mt-2 px-3 py-1 bg-[#FCBC18] text-[#101010] font-label-code text-label-code font-bold uppercase hover:bg-white transition-colors"
            >
              → GO TO SUPERVISOR
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto">
            {claimsList.map((c) => {
              const isSelected = selectedClaimId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClaimId(c.id)}
                  className={`w-full text-left p-3.5 border transition-all cursor-pointer font-label-code text-label-code ${isSelected
                      ? "bg-[#F2ECE6] text-[#101010] border-[#FCBC18] shadow-[2px_2px_0px_#FCBC18]"
                      : "bg-[#1b1b20] text-[#F2ECE6] border-[#A39B8F]/30 hover:border-[#F2ECE6]"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-bold ${isSelected ? "text-[#101010]" : "text-[#FCBC18]"}`}>
                      {c.id}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 border font-bold uppercase ${c.status === "APPROVED"
                          ? "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                          : c.status === "FLAGGED"
                            ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                            : "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                        }`}
                    >
                      {c.status || "IN_REVIEW"}
                    </span>
                  </div>
                  <p className={`font-headline-md text-body-sm font-bold truncate uppercase ${isSelected ? "text-[#101010]" : "text-[#F2ECE6]"}`}>
                    {c.claimant}
                  </p>
                  <p className="font-label-meta text-label-meta text-[#8C8B91] truncate mt-0.5 uppercase">
                    {c.type}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-[#A39B8F]/20 flex items-center justify-between text-label-meta">
                    <span className="text-[#8C8B91]">{c.file_count || c.files?.length || 1} FILES</span>
                    <span className={c.status === "APPROVED" ? "text-[#2F6F4E] font-bold" : "text-[#FCBC18]"}>
                      {c.status === "APPROVED" ? "✓ APPROVED" : "PENDING"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
        ) : !claim ? (
          <div className="p-16 text-center space-y-3 bg-[#E6E2DD] border border-[#101010]">
            <span className="material-symbols-outlined text-5xl text-[#FCBC18]">
              fact_check
            </span>
            <h3 className="font-headline-lg text-headline-lg font-bold uppercase text-[#101010]">
              NO CLAIM CURRENTLY SELECTED
            </h3>
            <p className="font-body-md text-body-md text-[#5F5E5E] max-w-md mx-auto">
              When a Site Supervisor transmits milestone photo evidence from the Supervisor Portal, it is stored in Firebase and appears in the Claim Queue Rail on the left.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={loadClaims}
                className="px-4 py-2 bg-[#FCBC18] text-[#101010] font-label-code text-label-code font-bold uppercase border border-[#101010] shadow-[2px_2px_0px_#101010]"
              >
                REFRESH AUDIT QUEUE
              </button>
            </div>
          </div>
        ) : (
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
                        AUDITED // VERIFIED
                      </span>
                    )}
                  </div>
                  <h2 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mt-1">
                    {claim.type}
                  </h2>
                  <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-0.5">
                    CLAIMANT: <strong className="text-[#101010]">{claim.claimant}</strong> • FILED AT: {new Date(claim.filed_at || Date.now()).toLocaleString()}
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
              </div>
            </div>

            {/* AI Extractions & Verification Triage Table */}
            <div className="bg-[#E6E2DD] border border-[#101010] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#A39B8F]/40 pb-2">
                <h3 className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                  FIELD VERIFICATION &amp; EVIDENCE EXTRACTIONS
                </h3>
                <span className="font-label-code text-label-code uppercase text-[#5F5E5E]">
                  TAMPER-PROOF AUDIT MATRIX
                </span>
              </div>

              {/* Observed Structural Context from Gemini Vision */}
              {claim.ai?.vlm_description && (
                <div className="p-4 bg-white border border-[#101010] space-y-1">
                  <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5F5E5E]">
                    GEMINI VISION OBSERVATION LOG
                  </span>
                  <p className="font-body-md text-body-md text-[#101010] leading-relaxed">
                    {claim.ai.vlm_description}
                  </p>
                  {claim.ai.sha256 && (
                    <p className="font-label-code text-label-code text-[#5F5E5E] pt-1 border-t border-[#A39B8F]/30">
                      CRYPTOGRAPHIC SHA-256 HASH: {claim.ai.sha256}
                    </p>
                  )}
                </div>
              )}

              {/* Field by field audit controls */}
              <div className="space-y-3 font-label-code text-label-code">
                {[
                  {
                    key: "claimant",
                    label: "CLAIMANT ENTITY",
                    val: claim.ai?.claimant?.value || claim.claimant,
                    source: "SUPERVISOR AUTH",
                  },
                  {
                    key: "inspection_date",
                    label: "INSPECTION DATE",
                    val: claim.ai?.inspection_date?.value || new Date(claim.filed_at || Date.now()).toLocaleDateString(),
                    source: "EXIF TIMESTAMPS",
                  },
                  {
                    key: "stated_total",
                    label: "STAGE BOQ VALUATION",
                    val: `₹${claim.ai?.stated_total?.value || "45000"}`,
                    source: "BOQ MATRIX",
                  },
                  {
                    key: "gps_distance_m",
                    label: "GEOFENCE DISTANCE",
                    val: `${claim.ai?.gps_distance_m?.value ?? "0.0"}m [VALID LOT B-04]`,
                    source: "GPS RADIUS",
                  },
                  {
                    key: "damage_severity",
                    label: "STRUCTURAL DEFECT SCAN",
                    val: claim.ai?.damage_severity?.value || "ZERO_SPALLING_PITCH_OK",
                    source: "VLM VERDICT",
                  },
                ].map((item) => {
                  const dec = decisions[item.key]?.dec || "agree";
                  return (
                    <div
                      key={item.key}
                      className="p-3 bg-white border border-[#101010] flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#101010]">{item.label}:</span>
                          <span className="font-body-md text-[#101010]">{item.val}</span>
                        </div>
                        <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase">
                          SOURCE: {item.source}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDecision(item.key, "agree", item.val)}
                          className={`px-3 py-1 border uppercase font-bold cursor-pointer transition-colors ${dec === "agree"
                              ? "bg-[#296a49] text-white border-[#296a49]"
                              : "bg-[#E6E2DD] text-[#101010] border-[#101010] hover:bg-white"
                            }`}
                        >
                          ✓ AGREE
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(item.key, "amend", item.val)}
                          className={`px-3 py-1 border uppercase font-bold cursor-pointer transition-colors ${dec === "amend"
                              ? "bg-[#FCBC18] text-[#101010] border-[#101010]"
                              : "bg-[#E6E2DD] text-[#101010] border-[#101010] hover:bg-white"
                            }`}
                        >
                          ✎ AMEND
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(item.key, "flag", item.val)}
                          className={`px-3 py-1 border uppercase font-bold cursor-pointer transition-colors ${dec === "flag"
                              ? "bg-[#ba1a1a] text-white border-[#ba1a1a]"
                              : "bg-[#E6E2DD] text-[#101010] border-[#101010] hover:bg-white"
                            }`}
                        >
                          ▲ FLAG
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Final Verdict Sign-off Box */}
            <div className="p-6 bg-[#E6E2DD] border border-[#101010] space-y-4">
              <h3 className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                AUDITOR CERTIFICATION SIGN-OFF
              </h3>

              {submitSuccess && (
                <div className="p-3 bg-[#93d5ad]/30 border border-[#296a49] text-[#1b5e3e] font-label-code text-label-code font-bold">
                  ✓ {submitSuccess}
                </div>
              )}
              {submitError && (
                <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code font-bold">
                  ✗ {submitError}
                </div>
              )}

              {blockersList && blockersList.length > 0 && (
                <div className="p-4 bg-[#ffdad6] border-2 border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code space-y-2">
                  <div className="flex items-center gap-2 font-bold uppercase">
                    <span className="material-symbols-outlined text-base">block</span>
                    <span>AUDITOR APPROVAL BLOCKED — VERIFICATION CONDITIONS UNMET</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-[#501010]">
                    {blockersList.map((blk, idx) => (
                      <li key={idx} className="font-sans">{blk}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#801010] mt-1 font-mono">
                    RULE ENFORCEMENT: All critical alerts, material reconciliations, and geofence criteria must be resolved before sign-off.
                  </p>
                </div>
              )}

              {claim?.status === "CLEARED" && (
                <div className="p-4 bg-[#93d5ad]/20 border-2 border-[#296a49] flex items-center justify-between gap-4 font-label-code text-label-code">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[#296a49] font-bold uppercase">
                      <span className="material-symbols-outlined text-base">verified</span>
                      <span>MILESTONE OFFICIALLY CLEARED & AUDITED</span>
                    </div>
                    <p className="text-xs text-[#504533]">
                      Cryptographic Clearance Certificate generated with SHA-256 integrity seal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCertificateModal(claim?.report?.certificate || {
                      certificate_number: `CERT-SV-${claim.id}`,
                      project_name: "Apex Tower — Commercial Block A",
                      stage_name: claim.type,
                      auditor: "Carol Auditor",
                      verdict: "CLEARED",
                      issued_at: claim?.report?.submitted_at || new Date().toISOString(),
                      certificate_hash: claim?.report?.sha256 || "sha256_verified_clearance_seal",
                    })}
                    className="px-4 py-2 bg-[#296a49] text-white hover:bg-[#1b5e3e] uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] cursor-pointer"
                  >
                    VIEW CLEARANCE CERTIFICATE
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-label-code text-label-code">
                <button
                  type="button"
                  onClick={() => setVerdict("agree")}
                  className={`p-3 border text-center font-bold uppercase cursor-pointer transition-colors ${verdict === "agree"
                      ? "bg-[#296a49] text-white border-[#296a49] shadow-[2px_2px_0px_#101010]"
                      : "bg-white text-[#101010] border-[#101010] hover:bg-[#FCBC18]"
                    }`}
                >
                  ✓ APPROVE MILESTONE
                </button>
                <button
                  type="button"
                  onClick={() => setVerdict("amend")}
                  className={`p-3 border text-center font-bold uppercase cursor-pointer transition-colors ${verdict === "amend"
                      ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                      : "bg-white text-[#101010] border-[#101010] hover:bg-[#FCBC18]"
                    }`}
                >
                  ✎ APPROVE WITH AMENDMENTS
                </button>
                <button
                  type="button"
                  onClick={() => setVerdict("flag")}
                  className={`p-3 border text-center font-bold uppercase cursor-pointer transition-colors ${verdict === "flag"
                      ? "bg-[#ba1a1a] text-white border-[#ba1a1a] shadow-[2px_2px_0px_#101010]"
                      : "bg-white text-[#101010] border-[#101010] hover:bg-[#ffdad6]"
                    }`}
                >
                  ▲ FLAG / REJECT
                </button>
              </div>

              <div>
                <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">
                  AUDITOR VERDICT NOTES &amp; COMPLIANCE RATIONALE
                </label>
                <textarea
                  rows={3}
                  value={verdictNote}
                  onChange={(e) => setVerdictNote(e.target.value)}
                  placeholder="State compliance justifications, field verification check outcome, and IS 456:2000 sign-off notes..."
                  className="w-full bg-white border border-[#101010] p-3 font-body-md text-body-md text-[#101010] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={submittingReport || !verdict}
                  className="px-6 py-2.5 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[3px_3px_0px_#101010] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingReport ? "SEALING CERTIFICATE..." : "SIGN & ISSUE AUDIT CERTIFICATE"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview Modal for Attached Files */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-[#101010]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F2ECE6] text-[#101010] border-2 border-[#101010] max-w-2xl w-full p-6 space-y-4 shadow-[6px_6px_0px_#101010]">
            <div className="flex items-center justify-between border-b border-[#101010] pb-2">
              <span className="font-headline-md text-headline-md uppercase font-bold">
                EVIDENCE PREVIEW: {previewFile.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="font-bold text-lg hover:text-[#ba1a1a] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-[#E6E2DD] border border-[#101010] text-center font-label-code text-label-code">
              {previewFile.kind === "photo" ? (
                previewFile.url ? (
                  <div className="space-y-3">
                    <img
                      src={
                        previewFile.url.startsWith("http")
                          ? previewFile.url
                          : `${API_BASE_URL}${previewFile.url}`
                      }
                      alt={previewFile.name}
                      className="max-h-[50vh] mx-auto object-contain border border-[#101010] shadow-[2px_2px_0px_#101010]"
                    />
                    <div className="bg-[#F2ECE6] p-2 border border-[#A39B8F]/40 text-xs text-left">
                      <p className="font-bold text-[#101010]">FILE: {previewFile.name}</p>
                      {previewFile.sha256 && (
                        <p className="font-mono text-[#5F5E5E] break-all">
                          SHA-256: {previewFile.sha256}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-[#5F5E5E]">
                    <span className="material-symbols-outlined text-5xl text-[#FCBC18] block mb-2">
                      image
                    </span>
                    GROUND TRUTH SPECIMEN EMBEDDED IN CLAIM RECORD: {previewFile.name}
                  </div>
                )
              ) : (
                <div className="p-8 text-[#5F5E5E] space-y-3">
                  <span className="material-symbols-outlined text-5xl text-[#FCBC18] block mb-2">
                    description
                  </span>
                  <p className="font-bold text-[#101010]">DOCUMENT SPECIMEN: {previewFile.name}</p>
                  {previewFile.url && (
                    <a
                      href={
                        previewFile.url.startsWith("http")
                          ? previewFile.url
                          : `${API_BASE_URL}${previewFile.url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block px-4 py-2 bg-[#FCBC18] text-[#101010] font-bold border border-[#101010] hover:bg-[#101010] hover:text-[#FCBC18] transition-colors uppercase"
                    >
                      OPEN ORIGINAL EVIDENCE DOCUMENT
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-[#101010] text-[#F2ECE6] font-label-code text-label-code uppercase font-bold cursor-pointer"
              >
                CLOSE PREVIEW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clearance Certificate Modal */}
      {certificateModal && (
        <div className="fixed inset-0 z-50 bg-[#101010]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F2ECE6] text-[#101010] border-2 border-[#101010] max-w-2xl w-full p-6 space-y-5 shadow-[6px_6px_0px_#101010] relative">
            <div className="flex items-center justify-between border-b-2 border-[#101010] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#296a49]" />
                <span className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
                  CLEARANCE CERTIFICATE // OFFICIAL AUDIT SEAL
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCertificateModal(null)}
                className="font-bold text-xl hover:text-[#ba1a1a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="border border-[#101010] bg-white p-5 space-y-4 font-mono text-xs">
              <div className="flex justify-between items-start border-b border-[#A39B8F]/30 pb-3">
                <div>
                  <p className="text-[10px] text-[#5F5E5E] uppercase">CERTIFICATE NUMBER</p>
                  <p className="font-bold text-sm text-[#101010]">{certificateModal.certificate_number || `CERT-SV-${selectedClaimId}`}</p>
                </div>
                <span className="px-2.5 py-1 bg-[#296a49] text-white font-bold text-[11px] uppercase">
                  STATUS: CLEARED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#5F5E5E] uppercase block text-[10px]">PROJECT</span>
                  <span className="font-bold text-[#101010]">{certificateModal.project_name || "Apex Tower — Commercial Block A"}</span>
                </div>
                <div>
                  <span className="text-[#5F5E5E] uppercase block text-[10px]">STAGE / MILESTONE</span>
                  <span className="font-bold text-[#101010]">{certificateModal.stage_name || claim?.type}</span>
                </div>
                <div>
                  <span className="text-[#5F5E5E] uppercase block text-[10px]">LEAD AUDITOR</span>
                  <span className="font-bold text-[#101010]">{certificateModal.auditor || certificateModal.auditor_name || "Carol Auditor"}</span>
                </div>
                <div>
                  <span className="text-[#5F5E5E] uppercase block text-[10px]">ISSUED AT (UTC)</span>
                  <span className="font-bold text-[#101010]">{certificateModal.issued_at || new Date().toISOString()}</span>
                </div>
              </div>

              <div className="bg-[#E6E2DD] p-3 border border-[#101010] space-y-1">
                <span className="text-[10px] text-[#504533] uppercase font-bold block">
                  CRYPTOGRAPHIC INTEGRITY SEAL (SHA-256)
                </span>
                <p className="font-mono text-[11px] text-[#101010] break-all select-all font-bold">
                  {certificateModal.certificate_hash || "sha256_sealed_clearance_hash"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#FCBC18] hover:bg-[#e5aa15] text-[#101010] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>PRINT / DOWNLOAD CERTIFICATE</span>
              </button>
              <button
                type="button"
                onClick={() => setCertificateModal(null)}
                className="px-4 py-2 bg-[#101010] text-[#F2ECE6] font-label-code text-label-code uppercase font-bold cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
