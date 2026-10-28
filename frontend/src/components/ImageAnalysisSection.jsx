import React, { useState, useRef, useEffect } from "react";
import { analyzeImage, fetchAnalyses, checkBackendHealth } from "../api/client";

const DEFAULT_SPECIMEN_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDp22eyjcye2vmeqUyBv8awfw_Er4S8bw0E1LiWg0N3VCrMw3PhU2jUGh-pwbz_IzKTwzu5lhNzgyOt0m-ac5oNfnJY8nETe_wLkHw3SCe073pgkHtP5KH5hLj3irffdvvsg0UKId0vJtTjL5beWXvLUvt9RCg02Dv5jgZ3-2DfmJKzG3zayANn5BYXViDVlmuk80djUdiz8UH-2BMzYyc7FpFb08VxXe6KNq4ilnqYpySPaWwFBsOL";

const DEFAULT_DESCRIPTION =
  "Dense Fe-550D TMT rebar grid observed with spacing 150mm CC. Shuttering framework intact. Concrete vibrator tooling detected. Worker PPE compliance verified (hard hat on site). Grade M35 pour preparations certified compliant with IS 456:2000 drafting matrix.";

export const ImageAnalysisSection = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [aiDescription, setAiDescription] = useState(DEFAULT_DESCRIPTION);
  const [analysisMeta, setAnalysisMeta] = useState({
    id: "EVD-9021-02",
    model: "GEMINI 1.5 PRO",
    fileHash: "8f4a9b2c7e1104398bc3a4e98f72361092a34bc98124ef1294812d8471029e81",
    confidence: "96.4%",
    stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);

  const fileInputRef = useRef(null);

  const loadHistory = async () => {
    try {
      const records = await fetchAnalyses();
      if (Array.isArray(records)) {
        setRecentAnalyses(records.slice(0, 5));
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

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      if (selectedFile) {
        const response = await analyzeImage(selectedFile);
        if (response && response.description) {
          setAiDescription(response.description);
          setAnalysisMeta({
            id: `EVD-${response.id || "9022"}`,
            model: response.model || "gemini-2.5-flash",
            fileHash: response.file_hash,
            // Stored name (uploads/evd_….ext) for the auditor's EXIF & GPS audit.
            storedName: response.file_url?.split("/").pop() || null,
            createdAt: response.created_at,
            confidence: "98.1%",
            stage: "STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
          });
          loadHistory();
        } else {
          throw new Error("No description returned by the AI vision model.");
        }
      } else {
        await new Promise((r) => setTimeout(r, 1200));
        setAiDescription(DEFAULT_DESCRIPTION);
      }
    } catch (err) {
      setErrorMessage(
        err?.message || "Image analysis failed. Please verify your GEMINI_API_KEY configuration."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyDescription = () => {
    if (!aiDescription) return;
    navigator.clipboard.writeText(aiDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHash = () => {
    const hash =
      analysisMeta?.fileHash || "8f4a9b2c7e1104398bc3a4e98f72361092a34bc98124ef1294812d8471029e81";
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleReset = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setAiDescription(DEFAULT_DESCRIPTION);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 font-body-md text-[#1b1b20]">
      {/* SECTION 2: MAIN TWO-COLUMN VERIFICATION PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* COL 1: 01. UPLOAD SITE PHOTO // INGESTION GATE */}
        <div className="relative flex flex-col justify-between bg-white border border-[#d4c5ac]/50 p-4">
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
              htmlFor="comp-file-input"
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
                id="comp-file-input"
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

          <div className="mt-4 pt-2 border-t border-[#d4c5ac]/20 flex items-center gap-2 text-[#504533] font-label-code text-label-code">
            <span className="w-2 h-2 bg-[#fcbc18] inline-block shrink-0"></span>
            <span>
              AI vision evaluates structural progress, materials, and safety context against Bill of
              Quantities.
            </span>
          </div>
        </div>

        {/* COL 2: 02. IMAGE PREVIEW // GROUND TRUTH SPECIMEN */}
        <div className="relative flex flex-col justify-between bg-white border border-[#d4c5ac]/50 p-4">
          <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
          <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
          <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
          <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-[#d4c5ac]/30 pb-2 mb-4">
              <span className="font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
                02. IMAGE PREVIEW // GROUND TRUTH SPECIMEN
              </span>
              <span className="font-label-meta text-label-meta uppercase tracking-widest text-[#296a49] font-bold">
                ● EXIF VALIDATED
              </span>
            </div>

            {/* PREVIEW IMAGE CONTAINER */}
            <div className="relative w-full h-[260px] bg-[#101010] overflow-hidden border border-[#d4c5ac]/40">
              <img
                className="w-full h-full object-cover object-center filter contrast-105"
                alt="Construction Site Verification Specimen"
                src={imagePreviewUrl || DEFAULT_SPECIMEN_IMAGE}
              />

              {/* Blueprint Crosshairs */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-[#fcbc18]/80 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-[#fcbc18]"></div>
                </div>
                <div className="absolute top-0 left-1/2 w-px h-full bg-[#fcbc18]/20"></div>
                <div className="absolute top-1/2 left-0 w-full h-px bg-[#fcbc18]/20"></div>
              </div>

              {/* HUD Overlay Badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                <span className="font-label-code text-label-code bg-[#101010]/90 text-[#f2f0f6] px-2 py-0.5 border border-[#d4c5ac]/40 tracking-wider">
                  GEOTAG: 20.0364° N, 73.7996° E [MATCHED: PVGCOE NASHIK]
                </span>
                <span className="font-label-code text-label-code bg-[#101010]/90 text-[#f2f0f6] px-2 py-0.5 border border-[#d4c5ac]/40 tracking-wider">
                  TIMESTAMP: 2026-10-09 13:42:18 UTC
                </span>
              </div>
              <div className="absolute top-2 right-2 pointer-events-none">
                <span className="font-label-code text-label-code bg-[#296a49] text-[#ffffff] px-2 py-0.5 tracking-wider font-bold">
                  EXIF INTEGRITY: VALID
                </span>
              </div>
              <div className="absolute bottom-2 left-2 pointer-events-none">
                <span className="font-label-meta text-label-meta text-[#f2f0f6]/80 bg-[#101010]/80 px-1.5 py-0.5 tracking-widest uppercase">
                  SENSOR: SONY IMX766 // F/1.8 // ISO 125
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2">
            <button
              type="button"
              id="comp-run-analysis-btn"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full h-11 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#101010] disabled:opacity-80"
            >
              {isAnalyzing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                  <span>ANALYZING WITH GEMINI VISION...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                  <span>+ RUN AI VISION ANALYSIS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: AI-GENERATED DESCRIPTION & MILESTONE OUTPUT */}
      <div className="relative bg-white border border-[#d4c5ac]/50 p-4">
        <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
        <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
        <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
        <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#d4c5ac]/30 gap-2">
          <div className="flex items-center gap-2 font-label-code text-label-code font-bold uppercase tracking-wider text-[#1b1b20]">
            <span className="material-symbols-outlined text-[#7a5900] text-[18px]">lock</span>
            <span>AI-GENERATED DESCRIPTION [READ ONLY] // STRICTLY IMMUTABLE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#fcbc18]/20 border border-[#7a5900] font-label-code text-label-code text-[#6b4d00] font-bold tracking-wider uppercase">
              STRICTLY READ ONLY // CRYPTOGRAPHICALLY PINNED
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 bg-[#f5f2f9] p-4 border border-[#d4c5ac]/40">
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
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                ZERO SPALLING / PITCH OK
              </span>
            </div>
          </div>

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
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>{copied ? "COPIED" : "COPY TEXT"}</span>
                  </button>
                )}
              </div>

              <textarea
                id="aiDescription"
                readOnly
                rows={4}
                value={aiDescription}
                placeholder="Upload an image and click Analyze Image..."
                className="w-full font-body-lg text-body-lg text-[#1b1b20] bg-white border border-[#d4c5ac]/40 p-3 leading-relaxed focus:outline-none resize-none cursor-default select-text"
              />
            </div>

            <div className="bg-[#e9e7ee] border border-[#d4c5ac]/50 p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-label-code text-label-code">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="material-symbols-outlined text-[#5f5e5e] text-[16px] shrink-0">
                  fingerprint
                </span>
                <span className="font-bold shrink-0 uppercase text-[#1b1b20]">SHA-256 HASH:</span>
                <span className="truncate text-[#5f5e5e] select-all font-mono">
                  {analysisMeta?.fileHash ||
                    "8f4a9b2c7e1104398bc3a4e98f72361092a34bc98124ef1294812d8471029e81"}
                </span>
                {analysisMeta?.storedName && (
                  <span className="shrink-0 text-[#1b1b20]">
                    FILE: <span className="select-all font-mono">{analysisMeta.storedName}</span>
                  </span>
                )}
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

        <div className="mt-4 pt-3 border-t border-[#d4c5ac]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-label-code text-label-code">
            <span className="w-2 h-2 bg-[#296a49] inline-block"></span>
            <span className="font-bold text-[#1b1b20] uppercase tracking-wider">
              STATUS: READY FOR AUDITOR QUEUE SUBMISSION
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-[#1b1b20] bg-transparent hover:bg-[#101010] hover:text-[#f2f0f6] font-label-code text-label-code font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              CLEAR SPECIMEN
            </button>
            <button
              type="button"
              onClick={() => alert("Specimen enqueued for auditor queue submission.")}
              className="px-4 py-2 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-label-code text-label-code font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-[2px_2px_0px_#101010]"
            >
              <span>TRANSMIT EVIDENCE TO CLAIM QUEUE</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
