import React, { useState, useEffect } from "react";
import { getAuthToken } from "../../api/client";

export const ImageViewer = ({ fileUrl, fileName, isPdf = false }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileUrl) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    let createdUrl = null;

    async function loadSecureFile() {
      try {
        setLoading(true);
        setError(null);
        const token = await getAuthToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(fileUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load file preview (${res.status})`);
        }

        const blob = await res.blob();
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (active) {
          console.warn("Could not load preview via blob, falling back to direct URL:", err);
          setBlobUrl(fileUrl);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSecureFile();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileUrl]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const displayUrl = blobUrl || fileUrl;

  if (isPdf) {
    return (
      <div className="flex flex-col h-full bg-[#101010] border-2 border-[#101010] shadow-[3px_3px_0px_#101010] rounded-none overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#101010] border-b border-[#333] text-xs font-mono text-[#F2ECE6]">
          <span className="truncate uppercase tracking-wider font-bold">
            [DOC] {fileName || "CHALLAN_DOCUMENT.PDF"}
          </span>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FCBC18] hover:underline font-mono uppercase text-[11px] font-bold"
          >
            [EXTRACT] ↗
          </a>
        </div>
        <div className="flex-1 w-full min-h-[400px] bg-white">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-[#6E675F]">
              STREAMING VECTOR PAYLOAD...
            </div>
          ) : (
            <iframe
              src={displayUrl}
              title="Challan PDF"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#101010] border-2 border-[#101010] shadow-[3px_3px_0px_#101010] rounded-none overflow-hidden">
      {/* Top Drafting Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#101010] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#F2ECE6] font-bold truncate max-w-[180px]">
            {fileName || "CHALLAN_SCAN.RAW"}
          </span>
          <span className="text-[10px] font-mono text-[#FCBC18] bg-[#FCBC18]/20 px-1 py-0.5 border border-[#FCBC18]/40">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2 py-0.5 text-xs bg-[#222] hover:bg-[#333] text-[#F2ECE6] border border-[#444] rounded-none cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-2 py-0.5 text-xs bg-[#222] hover:bg-[#333] text-[#F2ECE6] border border-[#444] rounded-none cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="px-2 py-0.5 text-xs bg-[#222] hover:bg-[#333] text-[#F2ECE6] border border-[#444] rounded-none cursor-pointer"
            title="Rotate 90°"
          >
            ↻ 90°
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-0.5 text-xs bg-[#222] hover:bg-[#333] text-[#F2ECE6] border border-[#444] rounded-none cursor-pointer"
            title="Reset View"
          >
            RST
          </button>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-2 py-0.5 text-xs text-[#FCBC18] hover:bg-[#FCBC18] hover:text-[#101010] border border-[#FCBC18] rounded-none"
            title="Open Full Image"
          >
            ↗
          </a>
        </div>
      </div>

      {/* Blueprint Grid Canvas */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#0d0d0d] min-h-[350px] relative">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #FCBC18 1px, transparent 1px), linear-gradient(to bottom, #FCBC18 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {loading ? (
          <div className="text-center text-[#FCBC18] text-xs font-mono py-12 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-2xl animate-spin">refresh</span>
            <span>ACQUIRING HIGH-RES RENDER...</span>
          </div>
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt="Challan Scan"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
            }}
            className="max-w-full max-h-[600px] object-contain border border-[#333] shadow-lg rounded-none z-10"
          />
        ) : (
          <div className="text-center text-[#6E675F] text-xs font-mono py-12">
            NO IMAGE PAYLOAD LINKED
          </div>
        )}
      </div>
    </div>
  );
};

