import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ImageAnalysisSection } from "../components/ImageAnalysisSection";
import ConstraLogo from "../components/common/ConstraLogo";

export const ImageAnalysisPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#fbf8ff] text-[#1b1b20] font-body-md flex flex-col selection:bg-[#fcbc18] selection:text-[#101010]">
      {/* Top Bar */}
      <header className="border-b border-[#d4c5ac]/30 bg-[#101010] text-[#f2f0f6] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group" title="Return to Home">
            <ConstraLogo className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
            <span className="font-headline-md text-headline-md tracking-wider font-bold text-[#f2f0f6] group-hover:text-[#fcbc18] transition-colors">
              CONSTRA
            </span>
          </Link>
          <div className="h-4 w-px bg-[#d4c5ac]/40 hidden sm:block"></div>
          <span className="hidden sm:inline font-label-code text-label-code bg-[#e4e1e8]/20 px-2 py-0.5 border border-[#d4c5ac]/30 text-[#f2f0f6] uppercase tracking-widest">
            AI VISION VERIFIER // STANDALONE TERMINAL
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Link
              to={
                user.role === "supervisor"
                  ? "/supervisor"
                  : user.role === "store_incharge"
                  ? "/store"
                  : "/auditor"
              }
              className="px-3 py-1 font-label-code text-label-code uppercase border border-[#d4c5ac]/40 text-[#f2f0f6] bg-[#e4e1e8]/20 hover:bg-[#fcbc18] hover:text-[#101010] transition-colors"
            >
              ← RETURN TO {user.role.toUpperCase()} PORTAL
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 font-label-code text-label-code font-bold uppercase bg-[#fcbc18] text-[#101010] border border-[#101010] hover:bg-white transition-colors shadow-[2px_2px_0px_#101010]"
            >
              SIGN IN
            </Link>
          )}
        </div>
      </header>

      {/* Subheader */}
      <div className="w-full bg-[#e9e7ee] border-b border-[#d4c5ac]/40 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between font-label-code text-label-code text-[#504533]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#fcbc18] inline-block"></span>
            <span className="font-bold text-[#1b1b20]">MODULE 01.B // REBAR &amp; CASTING AUDIT</span>
          </div>
          <div className="flex items-center gap-1 text-[#296a49]">
            <span className="w-1.5 h-1.5 bg-[#296a49] inline-block animate-pulse"></span>
            <span>AI VISION ENGINE NOMINAL</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Page Hero */}
        <div className="relative bg-white border border-[#d4c5ac]/40 p-4">
          <div className="absolute -top-[2px] -left-[2px] w-2 h-2 border-t-2 border-l-2 border-[#fcbc18]"></div>
          <div className="absolute -top-[2px] -right-[2px] w-2 h-2 border-t-2 border-r-2 border-[#fcbc18]"></div>
          <div className="absolute -bottom-[2px] -left-[2px] w-2 h-2 border-b-2 border-l-2 border-[#fcbc18]"></div>
          <div className="absolute -bottom-[2px] -right-[2px] w-2 h-2 border-b-2 border-r-2 border-[#fcbc18]"></div>

          <h1 className="font-headline-lg text-headline-lg uppercase font-bold text-[#1b1b20]">
            AI SITE IMAGE VERIFICATION // STANDALONE SUITE
          </h1>
          <p className="font-body-md text-body-md text-[#504533] mt-1 max-w-3xl">
            Automated image analysis using the CONSTRA AI vision engine. Verified
            descriptions are immutable, cryptographically pinned, and synced with the field audit queue.
          </p>
        </div>

        <ImageAnalysisSection />
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#e9e7ee] border-t border-[#d4c5ac]/40 py-3 px-6 text-center font-label-code text-label-code text-[#504533]">
        CONSTRA &copy; 2026 // AI VISION ANALYSIS ENGINE
      </footer>
    </div>
  );
};
