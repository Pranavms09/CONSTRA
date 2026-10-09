import React, { useState, useRef, useEffect } from "react";
import { analyzeImage, fetchAnalyses, checkBackendHealth } from "../api/client";

export const ImageAnalysisSection = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [aiDescription, setAiDescription] = useState("");
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);
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

  // Check backend health & Gemini status on mount
  useEffect(() => {
    checkBackendHealth()
      .then((data) => setBackendStatus(data))
      .catch(() => setBackendStatus({ status: "offline", gemini_configured: false }));

    loadHistory();
  }, []);

  const handleFileChange = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, WEBP, GIF).");
      return;
    }

    // Revoke previous object URL if any to avoid memory leak
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
    // Note: Do not auto-clear description or generate fake descriptions;
    // previous description will be cleanly replaced when user analyzes this new image.
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
    if (!selectedFile || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await analyzeImage(selectedFile);

      // Populate the field strictly with the description returned by the backend
      if (response && response.description) {
        setAiDescription(response.description);
        setAnalysisMeta({
          id: response.id,
          model: response.model,
          source: response.source,
          fileHash: response.file_hash,
          createdAt: response.created_at,
          filename: response.filename,
        });
        loadHistory();
      } else {
        throw new Error("No description returned by the AI vision model.");
      }
    } catch (err) {
      // Display error message if image analysis fails.
      // If analysis fails, do NOT display a fabricated description.
      setErrorMessage(
        err?.message || "Image analysis failed. Please verify your GEMINI_API_KEY configuration."
      );
      // Ensure no fabricated description is displayed
      setAiDescription("");
      setAnalysisMeta(null);
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

  const handleReset = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setAiDescription("");
    setAnalysisMeta(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
      {/* Card Header */}
      <div className="p-6 border-b border-slate-800/80 bg-linear-to-r from-slate-900 via-slate-900/90 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400 shrink-0">
            📸
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              AI Site Image Verification
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Gemini Vision
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload on-site evidence photos to receive automated, tamper-proof AI descriptions.
            </p>
          </div>
        </div>

        {/* Backend / Gemini Status Pill */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {backendStatus?.gemini_configured ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Gemini Vision Ready
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              API Key Not Configured
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-3 transition-all"
          >
            <span className="text-base leading-none text-red-400 shrink-0">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-red-300 mb-0.5">Image Analysis Error</div>
              <p className="leading-relaxed font-mono">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 text-xs uppercase font-semibold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Split: Upload Area & Preview Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step 1: Upload Zone */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Upload Site Photo
              </span>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 min-h-55 ${
                isDragging
                  ? "border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  : "border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-2xl mb-3 shadow-inner">
                📁
              </div>
              <p className="text-sm font-semibold text-white">
                Drag & drop site photo here, or <span className="text-amber-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports JPG, PNG, WEBP, GIF (up to 15MB)
              </p>

              {selectedFile && (
                <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 max-w-full truncate">
                  Selected: <span className="text-amber-300 font-semibold">{selectedFile.name}</span> (
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Image Preview Area */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. Image Preview
            </span>

            <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-3 min-h-55 flex items-center justify-center relative overflow-hidden">
              {imagePreviewUrl ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="relative max-h-55 w-full flex items-center justify-center rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                    <img
                      src={imagePreviewUrl}
                      alt="Site Preview"
                      className="max-h-55 w-auto object-contain rounded-lg"
                    />
                    <div className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-950/80 backdrop-blur border border-slate-700/60 text-[10px] font-mono text-slate-300">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <span className="text-3xl block mb-2 opacity-50">🖼️</span>
                  <p className="text-xs">No image selected</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Uploaded photo preview will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Analyze Image Action Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>AI vision evaluates structural progress, materials, and safety context.</span>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
              !selectedFile || isAnalyzing
                ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60"
                : "bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/10 active:scale-[0.99]"
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing Image with Gemini...</span>
              </>
            ) : (
              <>
                <span>✨ Analyze Image</span>
              </>
            )}
          </button>
        </div>

        {/* Loading Indicator Banner */}
        {isAnalyzing && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3.5 animate-pulse">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-amber-300">
                Google Gemini Vision model analyzing image features...
              </p>
              <p className="text-amber-400/80 font-mono mt-0.5">
                Scanning reinforcement rebar, concrete pouring, shuttering formwork, and site safety condition.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: AI Description Field (Read Only) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-2">
            {/* Exactly as requested in prompt */}
            <label
              htmlFor="aiDescription"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              <span>AI-Generated Description (Read Only)</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                🔒 STRICTLY READ ONLY
              </span>
            </label>

            {aiDescription && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyDescription}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            {/* Strictly read-only textarea with exact ID */}
            <textarea
              id="aiDescription"
              rows={6}
              readOnly
              value={aiDescription}
              placeholder="Upload an image and click Analyze Image..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm font-sans text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y leading-relaxed select-text cursor-not-allowed"
            />
          </div>

          {/* Description Provenance / Security Footer */}
          {analysisMeta && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 flex items-center gap-1">
                  ✓ Backend Verified
                </span>
                <span>Model: <span className="text-slate-200">{analysisMeta.model}</span></span>
                {analysisMeta.id && (
                  <span>Record #{analysisMeta.id}</span>
                )}
              </div>
              {analysisMeta.fileHash && (
                <div className="text-slate-500 truncate max-w-xs" title={analysisMeta.fileHash}>
                  SHA-256: {analysisMeta.fileHash.substring(0, 16)}...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Database Audit Trail: Recent Analyzed Images */}
        {recentAnalyses.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Database Records • Verified Milestones
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Immutable Server Audit Trail
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentAnalyses.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 truncate">{rec.filename}</span>
                    <span className="font-mono text-[10px] text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                      ID #{rec.id}
                    </span>
                  </div>
                  <p className="text-slate-400 line-clamp-2 leading-relaxed">
                    {rec.description}
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
                    <span>{rec.model}</span>
                    <span>{rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : "Saved"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
