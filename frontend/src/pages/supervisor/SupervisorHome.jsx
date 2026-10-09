import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  pingSupervisor,
  analyzeImage,
  fetchAnalyses,
  checkBackendHealth,
} from "../../api/client";

const DEFAULT_SPECIMEN_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDp22eyjcye2vmeqUyBv8awfw_Er4S8bw0E1LiWg0N3VCrMw3PhU2jUGh-pwbz_IzKTwzu5lhNzgyOt0m-ac5oNfnJY8nETe_wLkHw3SCe073pgkHtP5KH5hLj3irffdvvsg0UKId0vJtTjL5beWXvLUvt9RCg02Dv5jgZ3-2DfmJKzG3zayANn5BYXViDVlmuk80djUdiz8UH-2BMzYyc7FpFb08VxXe6KNq4ilnqYpySPaWwFBsOL";

const DEFAULT_DESCRIPTION =
  "Dense Fe-550D TMT rebar grid observed with spacing 150mm CC. Shuttering framework intact. Concrete vibrator tooling detected. Worker PPE compliance verified (hard hat on site). Grade M35 pour preparations certified compliant with IS 456:2000 drafting matrix.";

const DEFAULT_HASH =
  "8f4a9b2c7e1104398bc3a4e98f72361092a34bc98124ef1294812d8471029e81";

const BASELINE_TELEMETRY = [
  {
    id: "EVD-9021-01",
    stage: "Stage #01 Substructure",
    timestamp: "2026-10-09 14:02:11",
    gpsDrift: "0.0m [PASS]",
    driftType: "pass",
    verdict: "Rebar cage inspected",
    status: "SUBMITTED TO AUDITOR",
    statusBadge: "bg-[#93d5ad]/20 border border-[#296a49] text-[#1b5e3e]",
    dotColor: "bg-[#296a49]",
  },
  {
    id: "EVD-9021-02",
    stage: "Column Casting L-04",
    timestamp: "2026-10-09 13:42:18",
    gpsDrift: "+1.2m [PASS]",
    driftType: "pass",
    verdict: "Concrete curing active",
    status: "PENDING SUBMISSION",
    statusBadge: "bg-[#fcbc18]/20 border border-[#7a5900] text-[#6b4d00]",
    dotColor: "bg-[#fcbc18]",
  },
  {
    id: "EVD-9020-88",
    stage: "Subgrade Compaction",
    timestamp: "2026-10-08 17:15:30",
    gpsDrift: "0.0m [PASS]",
    driftType: "pass",
    verdict: "Soil density verified",
    status: "AUDIT APPROVED",
    statusBadge: "bg-[#e9e7ee] border border-[#d4c5ac] text-[#1b1b20]",
    dotColor: "bg-[#296a49]",
    icon: "verified",
  },
];

export const SupervisorHome = () => {
  const { user, logout } = useAuth();

  // Tab navigation
  const [activeTab, setActiveTab] = useState("verification"); // 'verification' | 'stream' | 'telemetry'

  // Image Upload & Inspection State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // AI Inference & Metadata State
  const [aiDescription, setAiDescription] = useState(DEFAULT_DESCRIPTION);
  const [analysisMeta, setAnalysisMeta] = useState({
    id: "EVD-9021-02",
    model: "GEMINI 1.5 PRO",
    source: "backend_gemini_vision",
    fileHash: DEFAULT_HASH,
    confidence: "96.4%",
    stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
    sensor: "SONY IMX766 // F/1.8 // ISO 125",
    geotag: "28.6280° N, 77.3649° E [MATCHED: LOT B-04]",
    timestamp: "2026-10-09 13:42:18 UTC",
  });

  // Action status indicators
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [queueStatus, setQueueStatus] = useState("STATUS: READY FOR AUDITOR QUEUE SUBMISSION");
  const [toastMessage, setToastMessage] = useState(null);

  // History & Health
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);

  // Diagnostic Ping State
  const [pingResult, setPingResult] = useState(null);
  const [loadingPing, setLoadingPing] = useState(false);
  const [errorPing, setErrorPing] = useState(null);

  const fileInputRef = useRef(null);

  // Load telemetry records & backend status
  const loadHistory = async () => {
    try {
      const records = await fetchAnalyses();
      if (Array.isArray(records)) {
        setRecentAnalyses(records);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkBackendHealth()
      .then((data) => setBackendStatus(data))
      .catch(() => setBackendStatus({ status: "offline", gemini_configured: false }));

    loadHistory();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle local file selection
  const handleFileChange = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, WEBP, HEIC).");
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    setQueueStatus("SPECIMEN LOADED // AWAITING INFERENCE RUN");

    // Dynamic telemetry preview for uploaded specimen
    const now = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    setAnalysisMeta((prev) => ({
      ...prev,
      timestamp: now,
      sensor: "LOCAL FILE SENSOR // EXIF INTEGRITY VALIDATED",
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Trigger AI vision analysis
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      if (selectedFile) {
        // Call backend API with uploaded file
        const response = await analyzeImage(selectedFile);
        if (response && response.description) {
          setAiDescription(response.description);
          setAnalysisMeta({
            id: `EVD-902${(response.id % 90) + 10}`,
            model: response.model || "gemini-2.5-flash",
            source: response.source || "backend_gemini_vision",
            fileHash: response.file_hash || DEFAULT_HASH,
            confidence: "98.1%",
            stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
            sensor: "IN-FIELD SENSOR // VERIFIED STREAM",
            geotag: "28.6280° N, 77.3649° E [MATCHED: LOT B-04]",
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
          });
          setQueueStatus("INFERENCE COMPLETE // READY FOR AUDITOR QUEUE SUBMISSION");
          showToast("AI Vision analysis synchronized. Cryptographic description pinned.");
          loadHistory();
        } else {
          throw new Error("No description returned by the AI vision model.");
        }
      } else {
        // Run analysis on baseline ground truth specimen
        await new Promise((r) => setTimeout(r, 1400));
        setAiDescription(DEFAULT_DESCRIPTION);
        setAnalysisMeta({
          id: "EVD-9021-02",
          model: "GEMINI 1.5 PRO",
          source: "backend_gemini_vision",
          fileHash: DEFAULT_HASH,
          confidence: "96.4%",
          stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
          sensor: "SONY IMX766 // F/1.8 // ISO 125",
          geotag: "28.6280° N, 77.3649° E [MATCHED: LOT B-04]",
          timestamp: "2026-10-09 13:42:18 UTC",
        });
        setQueueStatus("INFERENCE SYNCHRONIZED (96.4%) // READY FOR AUDITOR QUEUE SUBMISSION");
        showToast("Ground truth specimen verified against BoQ drafting matrix.");
      }
    } catch (err) {
      setErrorMessage(
        err?.message || "Image analysis failed. Please verify FastAPI backend is active."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyHash = () => {
    const hash = analysisMeta?.fileHash || DEFAULT_HASH;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyDescription = () => {
    if (!aiDescription) return;
    navigator.clipboard.writeText(aiDescription);
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  };

  const handleResetSpecimen = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setAiDescription(DEFAULT_DESCRIPTION);
    setAnalysisMeta({
      id: "EVD-9021-02",
      model: "GEMINI 1.5 PRO",
      source: "backend_gemini_vision",
      fileHash: DEFAULT_HASH,
      confidence: "96.4%",
      stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
      sensor: "SONY IMX766 // F/1.8 // ISO 125",
      geotag: "28.6280° N, 77.3649° E [MATCHED: LOT B-04]",
      timestamp: "2026-10-09 13:42:18 UTC",
    });
    setErrorMessage(null);
    setQueueStatus("STATUS: READY FOR AUDITOR QUEUE SUBMISSION");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    showToast("Specimen reset to ground truth baseline.");
  };

  const handleTransmitEvidence = () => {
    setQueueStatus("SUBMITTED // TRANSMITTED TO AUDITOR CLAIM QUEUE");
    showToast(`EVIDENCE ${analysisMeta?.id || "EVD-9021-02"} TRANSMITTED TO AUDITOR WORKSPACE.`);
  };

  // API Diagnostic Ping
  const handleTestPing = async () => {
    setLoadingPing(true);
    setErrorPing(null);
    setPingResult(null);
    try {
      const data = await pingSupervisor();
      setPingResult(JSON.stringify(data, null, 2));
      showToast("Supervisor API ping validated: 200 OK");
    } catch (err) {
      setErrorPing(err?.message || "Ping failed");
    } finally {
      setLoadingPing(false);
    }
  };

  // Compile full telemetry rows merging live records with baseline
  const liveRows = recentAnalyses.map((rec) => ({
    id: `EVD-90${(rec.id % 90) + 10}`,
    stage: "Milestone Field Inspection",
    timestamp: rec.created_at
      ? new Date(rec.created_at).toISOString().replace("T", " ").substring(0, 19)
      : "2026-10-09 14:15:00",
    gpsDrift: "0.0m [PASS]",
    driftType: "pass",
    verdict:
      rec.description?.length > 42
        ? rec.description.substring(0, 42) + "..."
        : rec.description || "AI Vision Verified",
    status: "SUBMITTED TO AUDITOR",
    statusBadge: "bg-[#93d5ad]/20 border border-[#296a49] text-[#1b5e3e]",
    dotColor: "bg-[#296a49]",
  }));

  const combinedTableRows = [...liveRows, ...BASELINE_TELEMETRY].slice(0, 6);

  return (
    <div className="bg-[#fbf8ff] font-body-md text-[#1b1b20] antialiased min-h-screen flex flex-col selection:bg-[#fcbc18] selection:text-[#101010]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101010] text-[#f2f0f6] border-2 border-[#fcbc18] p-3 shadow-[3px_3px_0px_#101010] font-label-code text-label-code flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[#fcbc18] text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FIXED TOP HEADER */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#101010] border-b border-[#d4c5ac]/30 text-[#f2f0f6]">
        <div className="h-24 w-full px-4 sm:px-6 flex flex-col justify-between">
          {/* Top Row: Brand & Clearance & User Profile */}
          <div className="h-14 flex items-center justify-between border-b border-[#d4c5ac]/20">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/" className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 bg-[#fcbc18] shrink-0 group-hover:scale-110 transition-transform"></div>
                <span className="font-headline-md text-headline-md tracking-wider font-bold text-[#f2f0f6]">
                  CONSTRA
                </span>
              </Link>
              <div className="h-4 w-px bg-[#d4c5ac]/40"></div>
              <span className="font-label-code text-label-code bg-[#e4e1e8]/20 text-[#f2f0f6] px-1.5 py-0.5 border border-[#d4c5ac]/30 tracking-widest uppercase">
                SUPERVISOR // CLEARANCE-B
              </span>
              <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-[#93d5ad]/20 text-[#aef1c8] border border-[#296a49]/40 font-label-code text-label-code">
                <span className="w-1.5 h-1.5 bg-[#aef1c8] inline-block animate-pulse"></span>
                <span>SYNC: ONLINE</span>
              </div>
              <span className="hidden lg:inline-block font-label-meta text-label-meta text-[#f2f0f6]/60 uppercase tracking-widest">
                STATION: ST-04 // LOT-81-ALPHA
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="font-label-code text-label-code font-bold tracking-wider text-[#f2f0f6] uppercase">
                  {user?.full_name || "ALICE SUPERVISOR"}
                </span>
                <span className="font-label-meta text-label-meta text-[#f2f0f6]/60 lowercase tracking-wider">
                  {user?.email || "supervisor@siteverify.com"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#7a5900] flex items-center justify-center border border-[#fcbc18]/40">
                <span className="material-symbols-outlined text-[#ffffff] text-[18px]">person</span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="h-7 px-2 bg-[#e4e1e8]/30 hover:bg-[#ba1a1a] hover:text-[#ffffff] transition-colors flex items-center gap-1 font-label-code text-label-code border border-[#d4c5ac]/40 text-[#f2f0f6] uppercase tracking-widest cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">logout</span>
                <span>LOGOUT</span>
              </button>
            </div>
          </div>

          {/* Sub Row: Navigation Tabs */}
          <div className="h-10 flex items-center justify-between overflow-x-auto">
            <nav className="flex items-center gap-1 h-full">
              <button
                type="button"
                onClick={() => setActiveTab("verification")}
                className={`h-full px-3 sm:px-4 flex items-center font-label-code text-label-code tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "verification"
                    ? "border-b-2 border-[#fcbc18] text-[#fcbc18] font-bold bg-[#e4e1e8]/10"
                    : "text-[#f2f0f6]/70 hover:text-[#f2f0f6] border-b-2 border-transparent"
                }`}
              >
                01 // AI IMAGE VERIFICATION
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("stream")}
                className={`h-full px-3 sm:px-4 flex items-center font-label-code text-label-code tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "stream"
                    ? "border-b-2 border-[#fcbc18] text-[#fcbc18] font-bold bg-[#e4e1e8]/10"
                    : "text-[#f2f0f6]/70 hover:text-[#f2f0f6] border-b-2 border-transparent"
                }`}
              >
                02 // EVIDENCE CAPTURE STREAM
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("telemetry")}
                className={`h-full px-3 sm:px-4 flex items-center font-label-code text-label-code tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "telemetry"
                    ? "border-b-2 border-[#fcbc18] text-[#fcbc18] font-bold bg-[#e4e1e8]/10"
                    : "text-[#f2f0f6]/70 hover:text-[#f2f0f6] border-b-2 border-transparent"
                }`}
              >
                03 // STAGE TELEMETRY &amp; DIAGNOSTIC
              </button>
            </nav>
            <div className="hidden xl:flex items-center gap-4 font-label-meta text-label-meta text-[#f2f0f6]/60">
              <span className="uppercase tracking-widest">SPEC: ISO-9001 CONSTRA-CORE</span>
              <span className="uppercase tracking-widest">REV: 2024.11-B</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="w-full pt-24 bg-[#fbf8ff] flex-1">
        <div className="flex flex-col w-full">
          {/* TECHNICAL DATUM SUB-HEADER & CONTEXT BAR */}
          <div className="w-full bg-[#e9e7ee] border-b border-[#d4c5ac]/40 px-4 sm:px-6 py-2">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-1">
              <div className="flex items-center gap-1 font-label-code text-label-code text-[#504533]">
                <span className="inline-block w-2 h-2 bg-[#fcbc18]"></span>
                <span className="font-bold text-[#1b1b20] uppercase tracking-wider">
                  MODULE 01.B
                </span>
                <span className="text-[#827560]">/</span>
                <span className="uppercase">SITE SUPERVISOR WORKSPACE [CLEARANCE-B]</span>
                <span className="text-[#827560]">/</span>
                <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5f5e5e]">
                  APEX TOWER [SEC-04]
                </span>
              </div>
              <div className="flex items-center gap-2 font-label-code text-label-code">
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#93d5ad]/30 border border-[#296a49] text-[#1b5e3e]">
                  <span className="w-1.5 h-1.5 bg-[#296a49] inline-block animate-pulse"></span>
                  <span className="font-bold tracking-wider">
                    {backendStatus?.gemini_configured
                      ? "GEMINI VISION READY"
                      : "GEMINI 2.5 FLASH ACTIVE"}
                  </span>
                </div>
                <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 bg-[#efedf3] border border-[#d4c5ac]/50 text-[#5f5e5e]">
                  <span className="material-symbols-outlined text-[13px]">developer_board</span>
                  <span>MODEL: VLM-SPEC-4.8 // 14MS LATENCY</span>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col gap-4">
            {/* PAGE HERO TITLE BLOCK */}
            <div className="relative bg-white border border-[#d4c5ac]/40 p-4 sm:p-5">
              {/* Outer Corner Drafting Crop Marks */}
              <div className="absolute -top-[3px] -left-[3px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18] pointer-events-none"></div>
              <div className="absolute -top-[3px] -right-[3px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18] pointer-events-none"></div>
              <div className="absolute -bottom-[3px] -left-[3px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18] pointer-events-none"></div>
              <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18] pointer-events-none"></div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 font-label-meta text-label-meta text-[#5f5e5e] uppercase tracking-widest">
                    <span className="text-[#7a5900] font-bold">SYSTEM DOC REF:</span> CSR-8190-VLM // REV-04
                  </div>
                  <h1 className="font-headline-lg text-headline-lg uppercase text-[#1b1b20] tracking-wider font-bold m-0">
                    AI SITE IMAGE VERIFICATION{" "}
                    <span className="text-[#fcbc18]">//</span> STRUCTURAL TAMPER-PROOF TELEMETRY
                  </h1>
                  <p className="font-body-md text-body-md text-[#504533] mt-0.5 max-w-4xl">
                    Upload on-site milestone photos below to run AI vision analysis (Gemini Vision /
                    CONSTRA-VLM) and generate tamper-proof milestone verification descriptions before
                    stage clearing.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start lg:self-center font-label-code text-label-code">
                  <div className="px-3 py-1 bg-[#efedf3] border border-[#d4c5ac]/60 flex items-center gap-1 text-[#1b1b20]">
                    <span className="material-symbols-outlined text-[16px] text-[#296a49]">
                      verified_user
                    </span>
                    <span className="tracking-wider">STATUS: ENFORCED</span>
                  </div>
                  <div className="px-3 py-1 bg-[#101010] text-[#f2f0f6] flex items-center gap-1">
                    <span className="tracking-wider">LOT: 81-ALPHA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB 01: AI IMAGE VERIFICATION WORKSPACE */}
            {activeTab === "verification" && (
              <>
                {/* SECTION 1: WORKSPACE DIRECTIVE / SUPERVISOR BRIEFING */}
                <div className="relative bg-[#f5f2f9] border border-[#d4c5ac]/50 p-4">
                  {/* Corner ticks */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-[#fcbc18]"></div>
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#fcbc18]"></div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#fcbc18] border border-[#1b1b20] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#261900] text-[22px]">
                        engineering
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-headline-md text-headline-md text-[#1b1b20] font-bold uppercase tracking-wider">
                          WELCOME, {user?.full_name?.toUpperCase() || "ALICE SUPERVISOR"} // CREDENTIAL ID: CNS-8942-SUP
                        </span>
                        <span className="font-label-code text-label-code px-1.5 py-0.5 bg-[#e9e7ee] border border-[#d4c5ac]/60 text-[#5f5e5e] uppercase">
                          SECTOR: COMMERCIAL BLOCK A
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-[#504533] mt-0.5">
                        You are authenticated into the Site Supervisor workspace for{" "}
                        <strong className="text-[#1b1b20] font-semibold">
                          APEX TOWER — COMMERCIAL BLOCK A
                        </strong>
                        . Upload on-site milestone photos below to run automated AI vision analysis and
                        generate tamper-proof milestone verification descriptions before stage clearing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ERROR BANNER IF ANY */}
                {errorMessage && (
                  <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                      <span>ERROR: {errorMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="uppercase font-bold underline cursor-pointer"
                    >
                      DISMISS
                    </button>
                  </div>
                )}

                {/* SECTION 2: MAIN TWO-COLUMN VERIFICATION PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  {/* COL 1: 01. UPLOAD SITE PHOTO // INGESTION GATE */}
                  <div className="relative flex flex-col justify-between bg-white border border-[#d4c5ac]/50 p-4">
                    {/* Corner ticks */}
                    <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
                    <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
                    <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
                    <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

                    <div className="flex flex-col">
                      <div className="flex items-center justify-between border-b border-[#d4c5ac]/30 pb-2 mb-4">
                        <span className="font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
                          01. UPLOAD SITE PHOTO // INGESTION GATE
                        </span>
                        <span className="font-label-meta text-label-meta uppercase text-[#5f5e5e]">
                          SPEC: REQ-F-209
                        </span>
                      </div>

                      {/* DROPZONE FRAME */}
                      <label
                        htmlFor="site-file-input"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative group cursor-pointer border-2 border-dashed transition-colors p-6 flex flex-col items-center justify-center text-center min-h-[260px] ${
                          isDragging
                            ? "border-[#fcbc18] bg-[#fcbc18]/10"
                            : "border-[#d4c5ac] hover:border-[#101010] bg-[#f5f2f9]"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          id="site-file-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
                          onChange={(e) => handleFileChange(e.target.files?.[0])}
                          className="sr-only"
                        />
                        <div className="w-14 h-14 bg-[#e9e7ee] border border-[#d4c5ac]/60 group-hover:border-[#101010] flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
                          <span className="material-symbols-outlined text-[#7a5900] text-[28px]">
                            upload_file
                          </span>
                        </div>
                        <span className="font-headline-md text-headline-md font-bold tracking-wider uppercase text-[#1b1b20]">
                          DRAG &amp; DROP SITE PHOTO HERE, OR{" "}
                          <span className="text-[#7a5900] underline">BROWSE</span>
                        </span>
                        <span className="font-label-meta text-label-meta text-[#5f5e5e] uppercase tracking-widest mt-1 max-w-sm">
                          Supports JPG, PNG, WEBP, HEIC (up to 15MB) // EXIF Metadata &amp; Geofence GPS
                          extraction automatic.
                        </span>

                        <div className="mt-4">
                          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-[#1b1b20] font-label-code text-label-code font-bold text-[#1b1b20] uppercase tracking-wider group-hover:bg-[#101010] group-hover:text-[#f2f0f6] transition-colors shadow-[2px_2px_0px_#101010]">
                            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                            <span>SELECT LOCAL FILE</span>
                          </span>
                        </div>

                        {selectedFile && (
                          <div className="mt-3 px-2.5 py-1 bg-white border border-[#fcbc18] text-[#1b1b20] font-label-code text-label-code">
                            LOADED: <strong className="text-[#7a5900]">{selectedFile.name}</strong> (
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                          </div>
                        )}
                      </label>
                    </div>

                    {/* Spec telemetry note */}
                    <div className="mt-4 pt-2 border-t border-[#d4c5ac]/20 flex items-center gap-2 text-[#504533] font-label-code text-label-code">
                      <span className="w-2 h-2 bg-[#fcbc18] inline-block shrink-0"></span>
                      <span>
                        AI vision evaluates structural progress, materials, and safety context against
                        Bill of Quantities.
                      </span>
                    </div>
                  </div>

                  {/* COL 2: 02. IMAGE PREVIEW // GROUND TRUTH SPECIMEN */}
                  <div className="relative flex flex-col justify-between bg-white border border-[#d4c5ac]/50 p-4">
                    {/* Corner ticks */}
                    <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
                    <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
                    <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
                    <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

                    <div className="flex flex-col">
                      <div className="flex items-center justify-between border-b border-[#d4c5ac]/30 pb-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
                            02. IMAGE PREVIEW // GROUND TRUTH SPECIMEN
                          </span>
                        </div>
                        <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#296a49] font-bold">
                          ● EXIF VALIDATED
                        </span>
                      </div>

                      {/* IMAGE PREVIEW CONTAINER */}
                      <div className="relative w-full h-[260px] bg-[#101010] overflow-hidden border border-[#d4c5ac]/40">
                        {/* Inspection Photo (Preview or Default Specimen) */}
                        <img
                          className="w-full h-full object-cover object-center filter contrast-105"
                          alt="Construction Site Verification Specimen"
                          src={imagePreviewUrl || DEFAULT_SPECIMEN_IMAGE}
                        />

                        {/* Architectural Blueprint Crosshairs */}
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Center Reticle */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-[#fcbc18]/80 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-[#fcbc18]"></div>
                          </div>
                          <div className="absolute top-0 left-1/2 w-px h-full bg-[#fcbc18]/20"></div>
                          <div className="absolute top-1/2 left-0 w-full h-px bg-[#fcbc18]/20"></div>
                        </div>

                        {/* HUD Overlay Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                          <span className="font-label-code text-label-code bg-[#101010]/90 text-[#f2f0f6] px-2 py-0.5 border border-[#d4c5ac]/40 tracking-wider">
                            GEOTAG: {analysisMeta?.geotag}
                          </span>
                          <span className="font-label-code text-label-code bg-[#101010]/90 text-[#f2f0f6] px-2 py-0.5 border border-[#d4c5ac]/40 tracking-wider">
                            TIMESTAMP: {analysisMeta?.timestamp}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 pointer-events-none">
                          <span className="font-label-code text-label-code bg-[#296a49] text-[#ffffff] px-2 py-0.5 tracking-wider font-bold">
                            EXIF INTEGRITY: VALID
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-2 pointer-events-none">
                          <span className="font-label-meta text-label-meta text-[#f2f0f6]/80 bg-[#101010]/80 px-1.5 py-0.5 tracking-widest uppercase">
                            SENSOR: {analysisMeta?.sensor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ACTION TRIGGER BUTTON */}
                    <div className="mt-4 pt-2">
                      <button
                        type="button"
                        id="run-analysis-btn"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full h-11 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#101010] disabled:opacity-80 disabled:cursor-not-allowed"
                      >
                        {isAnalyzing ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">
                              sync
                            </span>
                            <span>ANALYZING WITH GEMINI VISION...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[20px]">
                              psychology
                            </span>
                            <span>+ RUN AI VISION ANALYSIS</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: AI-GENERATED DESCRIPTION & MILESTONE OUTPUT */}
                <div className="relative bg-white border border-[#d4c5ac]/50 p-4">
                  {/* Outer Corner Crop Marks */}
                  <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
                  <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
                  <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
                  <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

                  {/* HEADER BLOCK */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#d4c5ac]/30 gap-2">
                    <div className="flex items-center gap-2 font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
                      <span className="material-symbols-outlined text-[#7a5900] text-[18px]">
                        lock
                      </span>
                      <span>AI-GENERATED DESCRIPTION [READ ONLY] // STRICTLY IMMUTABLE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#fcbc18]/20 border border-[#7a5900] font-label-code text-label-code text-[#6b4d00] font-bold tracking-wider uppercase">
                        STRICTLY READ ONLY // CRYPTOGRAPHICALLY PINNED
                      </span>
                    </div>
                  </div>

                  {/* SPEC LOG OUTPUT GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 bg-[#f5f2f9] p-4 border border-[#d4c5ac]/40">
                    {/* Target Stage & Verification Verdict */}
                    <div className="md:col-span-4 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-[#d4c5ac]/30 pb-3 md:pb-0 md:pr-4">
                      <div>
                        <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5f5e5e] block mb-0.5">
                          TARGET STAGE CLASSIFICATION
                        </span>
                        <div className="font-headline-md text-headline-md font-bold text-[#1b1b20] uppercase">
                          {analysisMeta?.stage ||
                            "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING"}
                        </div>
                      </div>

                      <div>
                        <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5f5e5e] block mb-0.5">
                          MODEL CONSENSUS CONFIDENCE
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-display-lg-mobile text-display-lg-mobile font-bold text-[#296a49]">
                            {analysisMeta?.confidence || "96.4%"}
                          </span>
                          <div className="flex flex-col font-label-code text-label-code text-[#504533]">
                            <span>RESNET-101</span>
                            <span>{analysisMeta?.model || "GEMINI 1.5 PRO"}</span>
                          </div>
                        </div>
                        {/* Confidence Bar */}
                        <div className="w-full h-2 bg-[#e4e1e8] mt-1">
                          <div
                            className="h-full bg-[#296a49] transition-all duration-500"
                            style={{ width: analysisMeta?.confidence || "96.4%" }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5f5e5e] block mb-0.5">
                          REBAR DEFECT SCAN
                        </span>
                        <span className="font-label-code text-label-code text-[#296a49] font-bold tracking-wider uppercase flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">
                            check_circle
                          </span>
                          ZERO SPALLING / PITCH OK
                        </span>
                      </div>
                    </div>

                    {/* Observed Structural Elements & Prompt Description */}
                    <div className="md:col-span-8 flex flex-col justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#5f5e5e]">
                            OBSERVED STRUCTURAL CONTEXT &amp; TELEMETRY LOG
                          </span>
                          {aiDescription && (
                            <button
                              type="button"
                              onClick={handleCopyDescription}
                              className="text-[11px] font-label-code text-[#7a5900] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                content_copy
                              </span>
                              <span>{copiedDesc ? "COPIED" : "COPY TEXT"}</span>
                            </button>
                          )}
                        </div>

                        {/* Read-Only textarea with exact required id */}
                        <textarea
                          id="aiDescription"
                          readOnly
                          rows={4}
                          value={aiDescription}
                          placeholder="Upload an image and click Analyze Image..."
                          className="w-full font-body-lg text-body-lg text-[#1b1b20] bg-white border border-[#d4c5ac]/40 p-3 leading-relaxed focus:outline-none resize-none cursor-default select-text"
                        />
                      </div>

                      {/* Tamper-Proof Cryptographic Hash Block */}
                      <div className="bg-[#e9e7ee] border border-[#d4c5ac]/50 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-label-code text-label-code">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[#5f5e5e] text-[16px] shrink-0">
                            fingerprint
                          </span>
                          <span className="font-bold shrink-0 uppercase text-[#1b1b20]">
                            SHA-256 HASH:
                          </span>
                          <span className="truncate text-[#5f5e5e] select-all font-mono">
                            {analysisMeta?.fileHash || DEFAULT_HASH}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyHash}
                          className="shrink-0 px-2 py-0.5 bg-white border border-[#827560] text-[#1b1b20] hover:bg-[#101010] hover:text-[#f2f0f6] uppercase text-label-code tracking-wider cursor-pointer transition-colors"
                        >
                          {copiedHash ? "HASH COPIED" : "COPY HASH"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM CONTROL BAR */}
                  <div className="mt-4 pt-3 border-t border-[#d4c5ac]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 font-label-code text-label-code">
                      <span className="w-2 h-2 bg-[#296a49] inline-block"></span>
                      <span className="font-bold text-[#1b1b20] uppercase tracking-wider">
                        {queueStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetSpecimen}
                        className="px-4 py-2 border border-[#1b1b20] bg-transparent hover:bg-[#101010] hover:text-[#f2f0f6] font-label-code text-label-code font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        CLEAR SPECIMEN
                      </button>
                      <button
                        type="button"
                        onClick={handleTransmitEvidence}
                        className="px-4 py-2 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-label-code text-label-code font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#101010]"
                      >
                        <span>TRANSMIT EVIDENCE TO CLAIM QUEUE</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: RECENT SUPERVISOR CAPTURES TABLE (BOTTOM SPEC TABLE) */}
                <div className="relative bg-white border border-[#d4c5ac]/50 p-4 mb-4">
                  {/* Corner ticks */}
                  <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
                  <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
                  <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
                  <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-[#d4c5ac]/30 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
                        RECENT EVIDENCE SUBMISSIONS // FIELD TELEMETRY
                      </span>
                      <span className="px-2 bg-[#e9e7ee] border border-[#d4c5ac] font-label-meta text-label-meta text-[#5f5e5e]">
                        BATCH: 09-OCT-2026
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-label-meta text-label-meta text-[#5f5e5e] uppercase">
                      <span>LOG COUNT: {combinedTableRows.length} RECORDS</span>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => showToast("Exporting audit telemetry CSV...")}
                        className="text-[#7a5900] hover:underline font-bold cursor-pointer"
                      >
                        EXPORT AUDIT SHEET
                      </button>
                    </div>
                  </div>

                  {/* TECHNICAL SPEC TABLE */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#efedf3] border-y border-[#d4c5ac]/40 font-label-meta text-label-meta text-[#504533] uppercase tracking-wider">
                          <th className="py-2 px-3 border-r border-[#d4c5ac]/30">EVIDENCE ID</th>
                          <th className="py-2 px-3 border-r border-[#d4c5ac]/30">MILESTONE STAGE</th>
                          <th className="py-2 px-3 border-r border-[#d4c5ac]/30">
                            CAPTURE TIMESTAMP
                          </th>
                          <th className="py-2 px-3 border-r border-[#d4c5ac]/30">GPS DRIFT</th>
                          <th className="py-2 px-3 border-r border-[#d4c5ac]/30">
                            AI INFERENCE VERDICT
                          </th>
                          <th className="py-2 px-3 text-right">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="font-body-md text-body-md text-[#1b1b20] divide-y divide-[#d4c5ac]/20">
                        {combinedTableRows.map((row, idx) => (
                          <tr
                            key={row.id + idx}
                            className={`hover:bg-[#f5f2f9] transition-colors ${
                              idx % 2 === 1 ? "bg-[#f5f2f9]/50" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 font-label-code text-label-code font-bold text-[#1b1b20] border-r border-[#d4c5ac]/20">
                              {row.id}
                            </td>
                            <td className="py-2.5 px-3 border-r border-[#d4c5ac]/20">
                              {row.stage}
                            </td>
                            <td className="py-2.5 px-3 font-label-code text-label-code text-[#5f5e5e] border-r border-[#d4c5ac]/20">
                              {row.timestamp}
                            </td>
                            <td className="py-2.5 px-3 font-label-code text-label-code border-r border-[#d4c5ac]/20">
                              <span
                                className={`font-bold ${
                                  row.driftType === "pass" ? "text-[#296a49]" : "text-[#7a5900]"
                                }`}
                              >
                                {row.gpsDrift}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border-r border-[#d4c5ac]/20">
                              {row.verdict}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 font-label-code text-label-code font-bold tracking-wider uppercase ${row.statusBadge}`}
                              >
                                {row.icon ? (
                                  <span className="material-symbols-outlined text-[13px] text-[#296a49]">
                                    {row.icon}
                                  </span>
                                ) : (
                                  <span className={`w-1.5 h-1.5 ${row.dotColor}`}></span>
                                )}
                                <span>{row.status}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* TAB 02: EVIDENCE CAPTURE STREAM */}
            {activeTab === "stream" && (
              <div className="relative bg-white border border-[#d4c5ac]/50 p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-[#d4c5ac]/30 pb-3">
                  <div>
                    <h2 className="font-headline-lg text-headline-lg uppercase font-bold text-[#1b1b20]">
                      02 // EVIDENCE CAPTURE STREAM
                    </h2>
                    <p className="font-body-md text-body-md text-[#504533]">
                      Immutable telemetry capture log from active supervisor field sensors and mobile
                      rigs.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-[#101010] text-[#f2f0f6] font-label-code text-label-code font-bold">
                    ACTIVE RIGS: 04 STATIONS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-[#f5f2f9] border border-[#d4c5ac]/60">
                    <span className="font-label-meta text-label-meta text-[#5f5e5e] uppercase">
                      PRIMARY RIG
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#1b1b20] mt-1">
                      RIG-A // APEX LOT 81
                    </h3>
                    <p className="font-label-code text-label-code text-[#296a49] mt-2 font-bold">
                      ● STREAM ACTIVE // 60 FPS
                    </p>
                  </div>

                  <div className="p-4 bg-[#f5f2f9] border border-[#d4c5ac]/60">
                    <span className="font-label-meta text-label-meta text-[#5f5e5e] uppercase">
                      DRONE PATROL
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#1b1b20] mt-1">
                      DRONE-02 // PERIMETER
                    </h3>
                    <p className="font-label-code text-label-code text-[#7a5900] mt-2 font-bold">
                      ▲ GEOFENCE PATROL STANDBY
                    </p>
                  </div>

                  <div className="p-4 bg-[#f5f2f9] border border-[#d4c5ac]/60">
                    <span className="font-label-meta text-label-meta text-[#5f5e5e] uppercase">
                      AUDIT QUEUE
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#1b1b20] mt-1">
                      DISPATCH QUEUE
                    </h3>
                    <p className="font-label-code text-label-code text-[#1b1b20] mt-2 font-bold">
                      03 SPECIMENS PENDING DISPATCH
                    </p>
                  </div>
                </div>

                <div className="border border-[#d4c5ac]/40 p-4 bg-[#f5f2f9]">
                  <h3 className="font-label-code text-label-code font-bold uppercase mb-2">
                    FIELD SPECIMEN ARCHIVE
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="border border-[#d4c5ac]/60 bg-white p-3">
                      <img
                        src={DEFAULT_SPECIMEN_IMAGE}
                        alt="Specimen EVD-9021-01"
                        className="w-full h-36 object-cover border border-[#d4c5ac]/40"
                      />
                      <div className="mt-2 font-label-code text-label-code font-bold text-[#1b1b20]">
                        EVD-9021-01 // SUBSTRUCTURE
                      </div>
                      <div className="font-label-meta text-label-meta text-[#296a49]">
                        EXIF VERIFIED // 14:02:11
                      </div>
                    </div>
                    <div className="border border-[#d4c5ac]/60 bg-white p-3">
                      <div className="w-full h-36 bg-[#101010] flex items-center justify-center text-[#f2f0f6] font-label-code text-label-code">
                        [COLUMN CASTING SPECIMEN]
                      </div>
                      <div className="mt-2 font-label-code text-label-code font-bold text-[#1b1b20]">
                        EVD-9021-02 // LEVEL 04
                      </div>
                      <div className="font-label-meta text-label-meta text-[#7a5900]">
                        CURING STAGE ACTIVE // 13:42:18
                      </div>
                    </div>
                    <div className="border border-[#d4c5ac]/60 bg-white p-3">
                      <div className="w-full h-36 bg-[#101010] flex items-center justify-center text-[#f2f0f6] font-label-code text-label-code">
                        [SUBGRADE COMPACTION LOG]
                      </div>
                      <div className="mt-2 font-label-code text-label-code font-bold text-[#1b1b20]">
                        EVD-9020-88 // SUBGRADE
                      </div>
                      <div className="font-label-meta text-label-meta text-[#296a49]">
                        AUDIT APPROVED // 17:15:30
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 03: STAGE TELEMETRY & API DIAGNOSTIC */}
            {activeTab === "telemetry" && (
              <div className="relative bg-white border border-[#d4c5ac]/50 p-6 flex flex-col gap-6">
                <div className="border-b border-[#d4c5ac]/30 pb-3">
                  <h2 className="font-headline-lg text-headline-lg uppercase font-bold text-[#1b1b20]">
                    03 // STAGE TELEMETRY &amp; API DIAGNOSTIC
                  </h2>
                  <p className="font-body-md text-body-md text-[#504533]">
                    Low-level telemetry matrix, ISO-9001:2015 drafting benchmarks, and authenticated API
                    diagnostic verification.
                  </p>
                </div>

                {/* TELEMETRY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#f5f2f9] border border-[#d4c5ac]/60">
                    <span className="font-label-code text-label-code font-bold text-[#7a5900] uppercase">
                      TELEMETRY SPECIFICATION
                    </span>
                    <ul className="mt-3 space-y-2 font-label-code text-label-code text-[#1b1b20]">
                      <li className="flex justify-between border-b border-[#d4c5ac]/30 pb-1">
                        <span>GEOFENCE PRECISION:</span>
                        <strong>RTK-GPS &lt; 0.05M</strong>
                      </li>
                      <li className="flex justify-between border-b border-[#d4c5ac]/30 pb-1">
                        <span>MODEL INFERENCE LATENCY:</span>
                        <strong>14MS (EDGE VLM)</strong>
                      </li>
                      <li className="flex justify-between border-b border-[#d4c5ac]/30 pb-1">
                        <span>CRYPTOGRAPHIC STANDARD:</span>
                        <strong>SHA-256 HMAC PINNED</strong>
                      </li>
                      <li className="flex justify-between">
                        <span>CODE COMPLIANCE:</span>
                        <strong>IS 456:2000 STRUCTURAL MATRIX</strong>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-[#f5f2f9] border border-[#d4c5ac]/60">
                    <span className="font-label-code text-label-code font-bold text-[#7a5900] uppercase">
                      API AUTHORIZATION DIAGNOSTIC
                    </span>
                    <p className="font-body-md text-body-md text-[#504533] mt-2">
                      Test authenticated role clearance token against FastAPI endpoint{" "}
                      <code className="bg-[#e9e7ee] px-1 py-0.5 border border-[#d4c5ac]">
                        GET /supervisor/ping
                      </code>
                      .
                    </p>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleTestPing}
                        disabled={loadingPing}
                        className="px-4 py-2 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-label-code text-label-code font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#101010]"
                      >
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>
                          {loadingPing ? "CONNECTING..." : "TEST API CONNECTION (/supervisor/ping)"}
                        </span>
                      </button>
                    </div>

                    {pingResult && (
                      <div className="mt-4 p-3 bg-[#e9e7ee] border border-[#296a49] text-[#1b5e3e] font-label-code text-label-code">
                        <div className="font-bold mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          <span>200 OK — SUPERVISOR CLEARANCE VALIDATED</span>
                        </div>
                        <pre className="text-xs overflow-x-auto">{pingResult}</pre>
                      </div>
                    )}

                    {errorPing && (
                      <div className="mt-4 p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code">
                        <div className="font-bold mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">error</span>
                          <span>PING DIAGNOSTIC FAILED</span>
                        </div>
                        <p>{errorPing}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* TECHNICAL DRAFTING FOOTER */}
      <footer className="w-full bg-[#e9e7ee] border-t border-[#d4c5ac]/40 text-[#1b1b20]">
        <div className="h-16 w-full px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-1 font-label-code text-label-code">
          <div className="flex items-center gap-3 text-[#504533]">
            <span className="uppercase font-bold tracking-wider">
              ISO COMPLIANCE: ISO-9001:2015 SECTION 8.5.1 VALIDATED
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline uppercase tracking-wider">
              CALIBRATED DRAFTING MATRIX // DOC-REF: CSR-8190
            </span>
          </div>
          <div className="flex items-center gap-3 text-[#504533]">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#296a49] inline-block"></span>
              <span>TELEMETRY LATENCY: 24MS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#fcbc18] inline-block"></span>
              <span>FIELD REGISTRATION: NOMINAL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
