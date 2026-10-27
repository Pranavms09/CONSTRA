import React, { useState, useRef } from "react";

export const FileUploader = ({ onFileSelected, isUploading, error }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);

  const validateAndSetFile = (file) => {
    setLocalError(null);
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setLocalError("Only genuine JPEG, PNG, or PDF challan files are accepted.");
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15 MB
    if (file.size > maxSize) {
      setLocalError("File exceeds the 15 MB maximum size limit.");
      return;
    }

    setSelectedFile(file);
    if (onFileSelected) {
      onFileSelected(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const displayedError = error || localError;

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed p-8 text-center cursor-pointer transition-none rounded-none ${
          dragActive
            ? "border-[#FCBC18] bg-[#FCBC18]/15"
            : "border-[#101010] hover:border-[#101010] bg-[#E6E2DD]/70 hover:bg-[#E6E2DD]"
        } ${isUploading ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
      >
        {/* Drafting Corner Crosshairs */}
        <span className="absolute top-1 left-1 font-mono text-[10px] text-[#A39B8F] select-none pointer-events-none">+</span>
        <span className="absolute top-1 right-1 font-mono text-[10px] text-[#A39B8F] select-none pointer-events-none">+</span>
        <span className="absolute bottom-1 left-1 font-mono text-[10px] text-[#A39B8F] select-none pointer-events-none">+</span>
        <span className="absolute bottom-1 right-1 font-mono text-[10px] text-[#A39B8F] select-none pointer-events-none">+</span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleChange}
          disabled={isUploading}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 bg-[#FCBC18] border-2 border-[#101010] shadow-[2px_2px_0px_#101010] flex items-center justify-center">
            {isUploading ? (
              <span className="material-symbols-outlined text-2xl text-[#101010] animate-spin">
                refresh
              </span>
            ) : (
              <span className="material-symbols-outlined text-2xl text-[#101010]">
                upload_file
              </span>
            )}
          </div>

          <div>
            <p className="font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-[#101010]">
              {isUploading
                ? "INGESTING & PARSING OCR TOKENS..."
                : selectedFile
                ? selectedFile.name
                : "DROP VENDOR CHALLAN OR CLICK TO SELECT FILE"}
            </p>
            <p className="font-['Archivo_Narrow'] text-xs text-[#6E675F] mt-1 font-mono">
              COMPLIANT FORMATS: PDF, JPEG, PNG (MAX 15.0 MB // 600 DPI COMPATIBLE)
            </p>
          </div>

          {selectedFile && !isUploading && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[#101010] shadow-[1px_1px_0px_#101010] text-xs font-mono text-[#2F6F4E] font-bold">
              <span>✓ READY FOR DISPATCH:</span>
              <span className="text-[#101010]">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>
      </div>

      {displayedError && (
        <div className="mt-3 p-3 bg-[#B3261E]/15 border-2 border-[#B3261E] text-[#B3261E] font-mono text-xs flex items-center gap-2">
          <span className="font-bold text-sm">⚠</span>
          <span>{displayedError}</span>
        </div>
      )}
    </div>
  );
};

