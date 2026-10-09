import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleHomeRoute } from "../auth/ProtectedRoute";

const CHAPTERS = [
  {
    id: 0,
    tag: "CHAPTER 00 // INITIAL STATE",
    ref: "REF: SECTOR-00 // FOUNDATION AUDIT",
    coordinates: "LAT 40.7128°N / LONG 74.0060°W // ELEV 14.2M",
    title: "Every claim proves itself.",
    quote: "“Civil infrastructure cannot run on verbal trust.”",
    description:
      "Site imagery, vendor delivery slips, and yard dispatches reconciled continuously against the engineering plan before any milestone is cleared.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDw-IYTv19maw4jyLXRfSz6L3NN88vDTeb9amS7BMKCIedvujHg4CF5LfHipkjGLvvKYzaMwoBapF7R3iJ0I0BUZD0MgF5tJmQ9z6yAy9CEOwYtOYmcp1xHslhPzY8IitiCBwlnQIXZVfeur8Menlm0thuAV17dPQKB7rgt7ZG9LCCWxOBSmRUNK1Q-6nrn-1IGdARRNq2hlrKZWM68mXMBK6NKYlKrBt7kUXY6zgMsncrIkFJCF9se",
    alt: "Raw concrete skeleton and yellow tower crane against dawn overcast sky",
    telemetry: {
      leftLabel: "INTEGRITY PROTOCOL",
      leftValue: "ACTIVE TELEMETRY",
      rightLabel: "TOLERANCE THRESHOLD",
      rightValue: "± 0.00% VARIANCE",
    },
    nextLabel: "NEXT: FIELD CAPTURE →",
  },
  {
    id: 1,
    tag: "CHAPTER 01 // CAPTURE",
    ref: "STAGE // HARDWARE TELEMETRY",
    coordinates: "EXIF GPS LOCK // RTK PRECISION ±1.4M",
    title: "Capture ground truth live.",
    quote: null,
    description:
      "Photos taken on site with location, timestamp, and compass bearing locked at the moment of shutter release. No retrospective gallery uploads. No spoofed coordinates.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCSOPH9RMbvNjAjCYxJIDGtXOz8-5IB9Zm-wXVMpVR_wzjeySmyctPSCy8V0C5VnBarlyYQ2yETPNfM4y7rJQKNDzaSMbqtfXegnOxXhpyFhGgc1WFd-WxGGOYZMubgjP0Hw1e1NSCZd47ifRr3mTnqxO4Fj5-Qhmohawriod46MpABjZWicbvYV772V1iBAD8JSJIFnscrmH1FpqgYtJC_y7iK-LtSVL__qsPaygPBR15RJvuPL4fL",
    alt: "Field engineer phone photographing cast-in-place concrete wall",
    telemetry: {
      leftLabel: "EXIF TIMESTAMP",
      leftValue: "14:22:09.102 UTC",
      rightLabel: "GEOLOCATION RADIUS",
      rightValue: "± 1.4 METERS CEP",
    },
    nextLabel: "NEXT: CHALLAN MATCH →",
  },
  {
    id: 2,
    tag: "CHAPTER 02 // MATCH",
    ref: "BILL OF QUANTITIES // AUTOMATED DELTA",
    coordinates: "OCR CHALLAN INTAKE // 0.00% VARIANCE",
    title: "Reconcile every delivery slip.",
    quote: null,
    description:
      "Delivery challans digitized instantly via multimodal OCR and matched against the Bill of Quantities schedule. Material issued from the store is bound directly to verified stage progress.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC3dYa2PliG7TfDMt8SU77M_Nn-jR7S0qpynTj1mg1Ku8e3ZwwLTbymC5SFlWnhb0TFWTZW8RM0PKhLGoaOL6ufIrALyTDgHDV-aneuP0-wbDzN4WpdOrv0EWxiMKlnbcgVIGOpDRv7LQgkOg8Ts94SKIZO5pd3xzi4smJdLm773cZSkOCILfqoAnj0HmBSE2cHR4F99_SB8BP_ONnwnIEnxn0Vik4MJchflSGCEsTJiT0855waVZ5f",
    alt: "Pallets of Portland cement bags, steel rebar bundles and receipt clipboard",
    telemetry: {
      leftLabel: "REBAR FE-550D PO#",
      leftValue: "CH-9812 // 24.5 MT",
      rightLabel: "BOQ SCHEDULE DELTA",
      rightValue: "0.00% VARIANCE",
    },
    nextLabel: "NEXT: AUDIT APPROVE →",
  },
  {
    id: 3,
    tag: "CHAPTER 03 // APPROVE",
    ref: "AUDIT CONVERGENCE GATE",
    coordinates: "EVIDENCE TRIAGE // MULTI-SIG CLEARANCE",
    title: "Approve only with proof.",
    quote: null,
    description:
      "Flags arrive with their full evidence chain: raw photo, OCR receipt, and variance log. A milestone clears only when every check passes. Zero verbal handshakes.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAjv0HUu3DK1vCs8biTraWx8_JyzGL0sr_u6hr8FOSY-638kmA5nf7I8esvk_xspKN3HwYjsNpG4EhpWNXJKjMwVgchCCxAOSayMnnmT1nVetEVTcninfo38c-JdcM2uUc0pp0UoeefTZMqq9OYhNS5nfCbiKqNYZZS6QHC6i-BUPnKDciAMSRqIcSd3wz0OJCluw-mIoNLlZfK3Bz8_RY71Qa4FKJOkP7W_YoUzlYjyAw8wiMeCy2b",
    alt: "Civil engineer audit desk overlooking construction floor with blueprints",
    telemetry: {
      leftLabel: "AUDIT CONSENSUS",
      leftValue: "ZERO UNRESOLVED FLAGS",
      rightLabel: "GATE STATUS",
      rightValue: "CONSENSUS CLEARED",
    },
    nextLabel: "NEXT: CRYPTO SEAL →",
  },
  {
    id: 4,
    tag: "CHAPTER 04 // SEAL",
    ref: "TAMPER-EVIDENT RECORD SEAL",
    coordinates: "CRYPTOGRAPHIC LEDGER // IMMUTABLE",
    title: "Verified once. Sealed forever.",
    quote: null,
    description:
      "Every cleared milestone is sealed in a tamper-evident audit ledger that cannot be retroactively modified. An unbroken cryptographic chain of physical construction execution.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAeLindz1DdFCB2MQu6_CFeBiX2oTTA546IysHglQ5ubrcz-C0IUyr-8zxSxvfbYQFXzXrpwamQRD9hS2LAZbVK8ej5w--WTU6cTDbnWUr7oxO39G30rsWu65HJJtmZQVVzSu94M9SGKFOnlLjq3jDiwWzYyTqFrTlUV3lW0kU3Aw3O66b4JFpKvxQSh2cVD3geX35yMb0jkjtC8TMJCOunin5lIAWFd_Zmr5NxwY_thvr8HPK5R43P",
    alt: "Industrial steel padlock clamped to structural rebar with yellow inspection tag",
    telemetry: {
      leftLabel: "HASH DIGEST",
      leftValue: "SHA-256 // SEALED",
      rightLabel: "RECORD STATUS",
      rightValue: "IMMUTABLE LEDGER",
    },
    nextLabel: "← REPLAY SEQUENCE",
  },
];

const LEAKAGE_VECTORS = [
  {
    code: "VEC-01",
    title: "Fabricated Progress",
    headline: "Recycled photo submissions across adjacent bays",
    description:
      "Subcontractors photograph the same completed column or beam from alternate angles, billing adjacent unfinished sectors before formwork has even commenced.",
    consequence: "Unearned capital drawdown and phantom progress on schedule charts.",
    defense: "Hardware-enforced EXIF GPS lock (±1.4m CEP), microsecond timestamp bounds, and optical angle hashing.",
    metric: "4.8% avg. budget inflation",
  },
  {
    code: "VEC-02",
    title: "Inflated Paperwork",
    headline: "Photocopied and manipulated delivery challans",
    description:
      "Vendors submit altered weight-bridge slips or duplicated challan numbers, billing 32 MT of TMT rebar when only 20 MT arrived on site.",
    consequence: "Procurement leaks where unsupplied materials are fully paid.",
    defense: "Automated OCR extraction with fuzzy vendor catalog matching, unique Challan No deduplication, and BOQ quantity caps.",
    metric: "6.3% procurement leakage",
  },
  {
    code: "VEC-03",
    title: "Material Diversion",
    headline: "Over-issuing stock to completed phases",
    description:
      "Yard materials are checked out for structural stages that have already been cast and cured, disguising off-site theft or diversion to unapproved commercial jobs.",
    consequence: "Physical inventory disappears while cost centres show fictitious absorption.",
    defense: "Strict mathematical ceiling: material issues cannot exceed the maximum theoretical consumption of verified progress.",
    metric: "9.1% bulk material loss",
  },
];

const PROTOCOL_NODES = [
  {
    step: "01",
    name: "CAPTURE",
    sub: "Live Hardware Lock",
    icon: "photo_camera",
    tag: "EDGE DEVICE",
    input: "In-situ camera sensor",
    output: "RTK EXIF metadata (lat/long/time)",
    desc: "Supervisor captures real-time evidence directly through the web terminal. Gallery uploads and camera roll submissions are cryptographically rejected.",
  },
  {
    step: "02",
    name: "INGEST",
    sub: "Multimodal Document OCR",
    icon: "document_scanner",
    tag: "VISION PARSER",
    input: "Physical vendor challan slip",
    output: "Structured line items & confidence scores",
    desc: "Store In-Charge uploads scanned slips. The vision engine digitizes vendor name, vehicle number, dispatch weight, and material grades with character-level confidence scores.",
  },
  {
    step: "03",
    name: "RECONCILE",
    sub: "Algorithmic BOQ Delta",
    icon: "balance",
    tag: "MATH ENGINE",
    input: "Challan quantity vs. BOQ allocation",
    output: "Over-delivery / Under-delivery delta",
    desc: "Delivered stock is mapped against the structural schedule. If cumulative delivery exceeds the BOQ cap by more than the tolerance, the delivery triggers an alert.",
  },
  {
    step: "04",
    name: "TRIAGE",
    sub: "Independent Auditor Desk",
    icon: "fact_check",
    tag: "CONSENSUS GATE",
    input: "Evidence dossier with flags",
    output: "Resolved / Rejected signoff",
    desc: "Project auditor inspects side-by-side photographic evidence, delivery receipts, and tolerance calculations. No payment certificate can clear with open anomalies.",
  },
  {
    step: "05",
    name: "SEAL",
    sub: "Cryptographic Certificate",
    icon: "lock",
    tag: "IMMUTABLE LEDGER",
    input: "Approved milestone state",
    output: "SHA-256 seal & exportable audit sheet",
    desc: "Once cleared, the milestone is permanently locked. Evidence, timestamps, and auditor signatures are combined into an unalterable verification certificate.",
  },
];

const ROLES_DATA = [
  {
    id: "supervisor",
    title: "Site Supervisor",
    badge: "TIER 01 // FIELD OPERATIONS",
    accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    roleKey: "supervisor",
    scope: "Field Ground Truth",
    summary:
      "Stationed on the deck. Captures live milestone progress photos, verifies stage completion, and attaches physical proof.",
    permissions: [
      { name: "Live Camera Capture", allowed: true },
      { name: "Milestone Progress Log", allowed: true },
      { name: "Upload Delivery Challans", allowed: false },
      { name: "Issue Warehouse Material", allowed: false },
      { name: "Resolve Audit Flags", allowed: false },
      { name: "Signoff & Seal Milestone", allowed: false },
    ],
    demoAccount: "Demo Supervisor",
  },
  {
    id: "store_incharge",
    title: "Store In-Charge",
    badge: "TIER 02 // INVENTORY & LOGISTICS",
    accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    roleKey: "store_incharge",
    scope: "Material Custody & Yard Dispatches",
    summary:
      "Controls the site perimeter. Digitizes vendor delivery challans via OCR, compares line items with the BOQ, and logs outbound material issued.",
    permissions: [
      { name: "Live Camera Capture", allowed: false },
      { name: "Milestone Progress Log", allowed: false },
      { name: "Upload Delivery Challans", allowed: true },
      { name: "Issue Warehouse Material", allowed: true },
      { name: "Review Material Alerts", allowed: true },
      { name: "Signoff & Seal Milestone", allowed: false },
    ],
    demoAccount: "Demo Store In-Charge",
  },
  {
    id: "auditor",
    title: "Project Auditor",
    badge: "TIER 03 // APEX GOVERNANCE",
    accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    roleKey: "auditor",
    scope: "Financial & Structural Consensus",
    summary:
      "The single gatekeeper between physical site execution and financial payment release. Inspects photographic evidence dossiers and grants final seals.",
    permissions: [
      { name: "Live Camera Capture", allowed: false },
      { name: "Milestone Progress Log", allowed: false },
      { name: "Upload Delivery Challans", allowed: false },
      { name: "Issue Warehouse Material", allowed: false },
      { name: "Resolve Audit Flags", allowed: true },
      { name: "Signoff & Seal Milestone", allowed: true },
    ],
    demoAccount: "Demo Auditor",
  },
];

export const LandingPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedRole, setSelectedRole] = useState(0);
  const [demoFlagResolved, setDemoFlagResolved] = useState(false);
  const [activeVector, setActiveVector] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keyboard navigation for chapter carousel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setCurrentSlide((prev) => (prev + 1) % CHAPTERS.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentSlide((prev) => (prev - 1 + CHAPTERS.length) % CHAPTERS.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const goToSlide = (idx) => {
    if (idx >= 0 && idx < CHAPTERS.length) {
      setCurrentSlide(idx);
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const activeChap = CHAPTERS[currentSlide];

  return (
    <div className="bg-[#0b0d11] text-[#e2e8f0] min-h-screen relative font-sans selection:bg-amber-400 selection:text-black">
      {/* Precision Drafting Grid Pattern Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Subtle Ambient Radial Lighting */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-amber-500/5 blur-[160px] rounded-full z-0" />

      {/* ========================================================================= */}
      {/* 1. ARCHITECTURAL MISSION HEADER                                           */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#0c0e13]/90 backdrop-blur-md border-b border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto h-[68px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Mark */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={() => scrollToSection("overview")}
              className="flex items-center space-x-3 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[#0b0d11] text-lg font-bold">
                  verified
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors font-mono">
                    CONSTRA
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-mono tracking-widest text-amber-400/90 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    V1.4
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 hidden sm:block">
                  Site Audit &amp; Reconciliation Engine
                </span>
              </div>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { label: "Overview", id: "how-it-works" },
              { label: "Vectors", id: "leakage-vectors" },
              { label: "Protocol", id: "protocol" },
              { label: "Inspection", id: "evidence-check" },
              { label: "Roles", id: "roles" },
              { label: "Compliance", id: "spec-2025" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-3 py-1.5 text-xs font-mono tracking-wider uppercase text-slate-300 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Action Terminal */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>CONSENSUS GATE: LIVE</span>
            </div>

            {user ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate(getRoleHomeRoute(user.role))}
                  className="bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0b0d11] font-mono font-bold text-xs uppercase px-3.5 py-2 rounded shadow-sm hover:shadow-amber-400/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <span>PORTAL CONSOLE</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
                <div
                  title={`Role: ${user.role}`}
                  className="w-8 h-8 rounded border border-white/10 bg-slate-800/80 flex items-center justify-center text-xs font-mono font-bold text-amber-400"
                >
                  {user.role ? user.role.slice(0, 2).toUpperCase() : "US"}
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 border border-white/20 hover:border-amber-400 text-white hover:text-amber-400 active:scale-[0.98] font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 rounded transition-all"
              >
                <span>SIGN IN</span>
                <span className="material-symbols-outlined text-xs">login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full" id="overview">
        {/* ========================================================================= */}
        {/* 2. ELEVATED HERO & TECHNICAL NARRATIVE CAROUSEL                           */}
        {/* ========================================================================= */}
        <section
          id="how-it-works"
          className="relative w-full border-b border-white/10 bg-[#0e1117] overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
            {/* Top Stage Telemetry Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-white/10 font-mono text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>CHAPTER SEQUENCE</span>
                </span>
                <span className="text-slate-300 font-medium">
                  STAGE 0{currentSlide} // {CHAPTERS[currentSlide].tag.split("//")[1]?.trim()}
                </span>
              </div>
              <div className="flex items-center space-x-6">
                <span className="hidden sm:inline-block text-slate-400 tabular-nums">
                  LAT 40.7128° N, LONG 74.0060° W
                </span>
                <div className="flex items-center space-x-1">
                  {CHAPTERS.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => goToSlide(i)}
                      className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                        i === currentSlide
                          ? "w-8 bg-amber-400"
                          : "w-2 bg-slate-700 hover:bg-slate-500"
                      }`}
                      aria-label={`Jump to stage 0${i}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Split Narrative Presentation Deck */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Mission Narrative & Direct Actions */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-4">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs" />
                  <span>{activeChap.tag}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] text-balance">
                  {activeChap.title}
                </h1>

                {activeChap.quote && (
                  <div className="border-l-2 border-amber-400 pl-4 py-1 mb-6 bg-amber-400/5 rounded-r">
                    <p className="text-base sm:text-lg text-amber-300/90 font-medium italic">
                      {activeChap.quote}
                    </p>
                  </div>
                )}

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
                  {activeChap.description}
                </p>

                {/* Telemetry Indicator Panel */}
                {activeChap.telemetry && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-[#141822] border border-white/10 mb-8 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 uppercase block tracking-wider text-[11px]">
                        {activeChap.telemetry.leftLabel}
                      </span>
                      <span className="text-white font-semibold text-sm tabular-nums">
                        {activeChap.telemetry.leftValue}
                      </span>
                    </div>
                    <div className="space-y-1 border-l border-white/10 pl-4">
                      <span className="text-slate-400 uppercase block tracking-wider text-[11px]">
                        {activeChap.telemetry.rightLabel}
                      </span>
                      <span className="text-amber-400 font-semibold text-sm tabular-nums">
                        {activeChap.telemetry.rightValue}
                      </span>
                    </div>
                  </div>
                )}

                {/* Carousel Controls and Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    to="/login"
                    className="bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0b0d11] font-mono font-bold text-xs uppercase px-5 py-3 rounded shadow-md hover:shadow-amber-400/20 flex items-center space-x-2 transition-all"
                  >
                    <span>INITIALIZE VERIFICATION</span>
                    <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
                  </Link>

                  <button
                    onClick={() => goToSlide((currentSlide + 1) % CHAPTERS.length)}
                    className="border border-white/20 hover:border-white/50 active:scale-[0.98] text-white hover:text-amber-300 font-mono text-xs uppercase px-4 py-3 rounded transition-all cursor-pointer flex items-center space-x-1.5"
                    type="button"
                  >
                    <span>{activeChap.nextLabel}</span>
                  </button>

                  <div className="flex items-center space-x-1 ml-auto">
                    <button
                      onClick={() =>
                        goToSlide((currentSlide - 1 + CHAPTERS.length) % CHAPTERS.length)
                      }
                      className="w-10 h-10 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Previous chapter"
                      aria-label="Previous chapter"
                    >
                      <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button
                      onClick={() => goToSlide((currentSlide + 1) % CHAPTERS.length)}
                      className="w-10 h-10 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Next chapter"
                      aria-label="Next chapter"
                    >
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Architectural Photography Frame & Crosshairs */}
              <div className="lg:col-span-6 relative">
                <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-[0_20px_60px_rgba(0,0,0,0.8)] aspect-[4/3] sm:aspect-[16/11]">
                  {/* Image with contrast enhancement */}
                  <img
                    src={activeChap.image}
                    alt={activeChap.alt}
                    className="w-full h-full object-cover object-center transition-all duration-700 brightness-90 contrast-115"
                  />

                  {/* Gradient Scrim Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-transparent to-black/30" />

                  {/* Drafting Crosshairs & Optical Frame Markers */}
                  <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400" />
                    <span className="font-mono text-[11px] text-amber-400 tracking-wider font-semibold">
                      {activeChap.ref}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <span className="w-2.5 h-2.5 border-t-2 border-r-2 border-amber-400 block" />
                  </div>
                  <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 border-b-2 border-l-2 border-amber-400" />
                    <span className="font-mono text-[10px] text-slate-300 tracking-wider">
                      {activeChap.coordinates}
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4 z-10 flex items-center space-x-1.5 font-mono text-[10px] text-amber-400 bg-black/80 px-2 py-0.5 rounded border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>FEED // LIVE LOCK</span>
                  </div>

                  {/* Center HUD Reticle */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-amber-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Chapter Quick Jump Selector Ribbon */}
                <div className="grid grid-cols-5 gap-2 mt-3 font-mono text-[11px]">
                  {CHAPTERS.map((chap, idx) => (
                    <button
                      key={chap.id}
                      onClick={() => goToSlide(idx)}
                      className={`py-2 px-1 text-center rounded border transition-all cursor-pointer ${
                        idx === currentSlide
                          ? "bg-amber-400/10 border-amber-400 text-amber-400 font-bold"
                          : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <span className="block text-[10px] opacity-75">CH 0{idx}</span>
                      <span className="truncate block font-semibold">
                        {chap.tag.split("//")[1]?.trim() || "INIT"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. SECTION: SYSTEMIC LEAKAGE VECTORS                                      */}
        {/* ========================================================================= */}
        <section
          id="leakage-vectors"
          className="w-full py-20 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#0b0d11]"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-white/10">
              <div>
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs" />
                  <span>01 // SYSTEMIC CAPITAL EROSION ANALYSIS</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white text-balance">
                  Where civil construction leaks capital.
                </h2>
              </div>
              <div className="font-mono text-xs text-slate-400 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>UNAUDITED SITE VARIANCE: 7.4% – 11.2% MARGIN LOSS</span>
              </div>
            </div>

            {/* Asymmetric Dossier Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
              {/* Left Column: High-Impact Risk Summary Card */}
              <div className="lg:col-span-4 flex flex-col justify-between p-6 rounded-xl bg-gradient-to-b from-[#141822] to-[#0f131a] border border-white/10">
                <div>
                  <div className="flex items-center space-x-2 text-rose-400 font-mono text-xs font-semibold mb-4">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>STRUCTURAL RECONCILIATION GAP</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 leading-snug">
                    Unverified paperwork drains reserves silently.
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    When site execution relies on honor-system approvals, paper delivery slips, and delayed monthly billing cycles, contractors absorb compound losses across concrete, rebar, and stage certification.
                  </p>
                </div>

                {/* Macro Metric Bar */}
                <div className="space-y-4 pt-4 border-t border-white/10 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>CUMULATIVE SITE LOSS</span>
                    <span className="text-rose-400 font-bold tabular-nums">11.2% MAX TIER</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="w-4/5 h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full" />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>CONSTRA INTERCEPT TIME</span>
                    <span className="text-emerald-400 font-semibold">&lt; 4.0 SECONDS</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Vector Explanations */}
              <div className="lg:col-span-8 space-y-4">
                {LEAKAGE_VECTORS.map((vec, idx) => {
                  const isSelected = activeVector === idx;
                  return (
                    <div
                      key={vec.code}
                      onClick={() => setActiveVector(idx)}
                      className={`p-6 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#141824] border-amber-500/50 shadow-lg shadow-amber-500/5"
                          : "bg-[#10131b] border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-3">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                              isSelected
                                ? "bg-amber-400 text-black border-amber-400"
                                : "bg-white/5 text-slate-300 border-white/10"
                            }`}
                          >
                            {vec.code}
                          </span>
                          <h4 className="text-lg font-bold text-white">{vec.title}</h4>
                        </div>
                        <span className="font-mono text-xs text-rose-400 font-medium">
                          {vec.metric}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-200 mb-2">{vec.headline}</p>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">
                        {vec.description}
                      </p>

                      {/* Tactical Intercept Defense Box */}
                      <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-xs text-emerald-300">
                        <span className="material-symbols-outlined text-base flex-shrink-0 text-emerald-400">
                          check_circle
                        </span>
                        <div>
                          <strong className="text-emerald-200 font-semibold">CONSTRA INTERCEPT: </strong>
                          <span>{vec.defense}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. SECTION: HOW VERIFICATION WORKS (PROTOCOL PIPELINE)                    */}
        {/* ========================================================================= */}
        <section
          id="protocol"
          className="w-full py-20 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#0d0f15]"
        >
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-white/10">
              <div>
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs" />
                  <span>02 // VERIFICATION PROTOCOL PIPELINE</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
                  5-Stage Continuous Verification Protocol
                </h2>
              </div>
              <div className="flex items-center space-x-2 font-mono text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>UNIDIRECTIONAL EVIDENCE PIPELINE</span>
              </div>
            </div>

            {/* Connected Node Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 lg:gap-6 mt-12">
              {PROTOCOL_NODES.map((node) => (
                <div
                  key={node.step}
                  className="flex flex-col justify-between p-5 rounded-xl bg-[#131620] border border-white/10 hover:border-amber-400/40 transition-all group relative"
                >
                  {/* Step Sequence Marker */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        NODE {node.step}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                        {node.tag}
                      </span>
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-xl">{node.icon}</span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1 tracking-tight">
                      {node.name}
                    </h3>
                    <p className="font-mono text-[11px] text-slate-400 mb-3">{node.sub}</p>

                    <p className="text-xs text-slate-300 leading-relaxed mb-4">{node.desc}</p>
                  </div>

                  {/* Input / Output Telemetry Tags */}
                  <div className="pt-3 border-t border-white/10 space-y-1.5 font-mono text-[10px]">
                    <div className="truncate text-slate-400">
                      <span className="text-slate-500 uppercase">IN: </span>
                      {node.input}
                    </div>
                    <div className="truncate text-amber-300">
                      <span className="text-slate-500 uppercase">OUT: </span>
                      {node.output}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. SECTION: INTERACTIVE EVIDENCE CHECK INSPECTION                         */}
        {/* ========================================================================= */}
        <section
          id="evidence-check"
          className="w-full py-20 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#0a0c10]"
        >
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs" />
                  <span>03 // LIVE EVIDENCE CHECK INSPECTION</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
                  Interactive Audit Dossier Simulator
                </h2>
              </div>
              <div className="font-mono text-xs text-slate-400 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>SANDBOX SPECIMEN: SEC-04 // SLAB CASTING</span>
              </div>
            </div>

            {/* Dossier Card Panel */}
            <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-[#141824] to-[#0f121a] p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden">
              {/* Corner Registration Accents */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-amber-400" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-amber-400" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-amber-400" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-amber-400" />

              {/* Title Bar & Status Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      SPECIMEN: Level 04 Post-Tensioned Slab Pour
                    </h3>
                    <span className="font-mono text-xs text-slate-400">
                      MILESTONE CLAIM: #MS-0482 // SECTOR TOWER-A
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono text-xs font-bold px-3 py-1.5 rounded border transition-colors flex items-center space-x-1.5 ${
                      demoFlagResolved
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {demoFlagResolved ? "verified" : "warning"}
                    </span>
                    <span>{demoFlagResolved ? "AUDIT CLEARED & LOCKED" : "EVIDENCE FLAGGED"}</span>
                  </span>
                </div>
              </div>

              {/* Parameter Check Rows */}
              <div className="divide-y divide-white/10 my-6">
                {/* Parameter 1: Geolocation */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-lg">pin_drop</span>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] text-slate-400 block">
                        CHECK 01 // GEOLOCATION
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Site Perimeter Coordinates
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 sm:text-right font-mono text-xs">
                    <span className="text-slate-300">
                      DELTA: <strong className="text-emerald-400">42m from centroid (≤ 150m)</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                      PASS
                    </span>
                  </div>
                </div>

                {/* Parameter 2: Shutter Release Latency */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-lg">schedule</span>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] text-slate-400 block">
                        CHECK 02 // TIMESTAMP VALIDATION
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Capture-to-Upload Latency
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 sm:text-right font-mono text-xs">
                    <span className="text-slate-300">
                      RECORD: <strong className="text-emerald-400">182 seconds (Live Capture)</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                      PASS
                    </span>
                  </div>
                </div>

                {/* Parameter 3: Visual Morphology Match (Interactive) */}
                <div
                  className={`py-4 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    demoFlagResolved
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-amber-500/10 border border-amber-500/30"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                        demoFlagResolved
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {demoFlagResolved ? "check_circle" : "report"}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] text-slate-400 block">
                        CHECK 03 // STRUCTURAL MORPHOLOGY
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Rebar Reinforcement Density
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 sm:text-right font-mono text-xs">
                    <span className="text-slate-200">
                      {demoFlagResolved ? (
                        <span className="text-emerald-300 font-medium">
                          Auditor verified via rebar delivery slip CH-9812
                        </span>
                      ) : (
                        <span className="text-amber-300 font-medium">
                          Flag: Optical rebar coverage below 65% threshold
                        </span>
                      )}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold border ${
                        demoFlagResolved
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      {demoFlagResolved ? "CLEARED" : "FLAGGED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Simulation Console */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="font-mono text-xs text-slate-400">
                  DECISION:{" "}
                  {demoFlagResolved ? (
                    <span className="text-emerald-400 font-bold">
                      ALL CHECKS PASSED // CRYPTOGRAPHIC SEAL RELEASED
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold">
                      PAYMENT RELEASE BLOCKED // AWAITING AUDITOR RESOLUTION
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button
                    onClick={() => setDemoFlagResolved(!demoFlagResolved)}
                    className="w-full sm:w-auto border border-white/20 hover:border-amber-400 active:scale-[0.98] text-white hover:text-amber-400 px-4 py-2.5 rounded font-mono text-xs uppercase tracking-wider transition-all cursor-pointer"
                    type="button"
                  >
                    {demoFlagResolved ? "Re-open Defect Flag" : "Simulate Auditor Triage"}
                  </button>

                  <button
                    disabled={!demoFlagResolved}
                    onClick={() => navigate("/login")}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center space-x-2 transition-all ${
                      demoFlagResolved
                        ? "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black shadow-lg shadow-amber-400/20 cursor-pointer"
                        : "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {demoFlagResolved ? "key" : "lock"}
                    </span>
                    <span>{demoFlagResolved ? "Unlock Portal" : "Gate Blocked"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. SECTION: ROLE AUTHORITY & RBAC MATRIX                                  */}
        {/* ========================================================================= */}
        <section
          id="roles"
          className="w-full py-20 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#0c0e14]"
        >
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-white/10">
              <div>
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-xs" />
                  <span>04 // ROLE AUTHORITY &amp; ACCESS MATRIX</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
                  Three Autonomous Operational Roles
                </h2>
              </div>
              <div className="font-mono text-xs text-slate-400">
                SPEC: ZERO-OVERLAP RBAC SECURITY STANDARD
              </div>
            </div>

            {/* Role Navigation Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              {ROLES_DATA.map((role, idx) => {
                const isActive = selectedRole === idx;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRole(idx)}
                    className={`p-6 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#151926] border-amber-400 shadow-xl shadow-amber-500/5 ring-1 ring-amber-400/30"
                        : "bg-[#10131c] border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`font-mono text-[10px] tracking-wider px-2 py-0.5 rounded border ${role.accent}`}
                        >
                          {role.badge}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{role.title}</h3>
                      <p className="font-mono text-xs text-amber-400 mb-4">{role.scope}</p>
                      <p className="text-sm text-slate-300 leading-relaxed mb-6">{role.summary}</p>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-2">
                      <div className="font-mono text-xs text-slate-400 mb-2 font-semibold">
                        KEY PERMISSIONS:
                      </div>
                      {role.permissions.map((perm) => (
                        <div
                          key={perm.name}
                          className="flex items-center justify-between font-mono text-xs"
                        >
                          <span className="text-slate-300">{perm.name}</span>
                          <span
                            className={`font-bold ${
                              perm.allowed ? "text-emerald-400" : "text-slate-600"
                            }`}
                          >
                            {perm.allowed ? "ENABLED" : "RESTRICTED"}
                          </span>
                        </div>
                      ))}

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <Link
                          to="/login"
                          className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                        >
                          <span>SIGN IN AS {role.title.toUpperCase()}</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. SECTION: CLOSING MANDATE & ARCHITECTURAL CTA                           */}
        {/* ========================================================================= */}
        <section
          id="spec-2025"
          className="w-full py-24 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#090b0e] relative overflow-hidden"
        >
          {/* Background Drafting Grid Watermark */}
          <div className="pointer-events-none absolute inset-0 opacity-10 flex items-center justify-center">
            <div className="w-[800px] h-[800px] border border-white/30 rounded-full flex items-center justify-center">
              <div className="w-[500px] h-[500px] border border-amber-400/50 flex items-center justify-center">
                <div className="w-[200px] h-[200px] border border-white/30 rotate-45" />
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-xs uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>CONSTRA MANDATE 2025 // SITE CERTAINTY</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-6 text-balance leading-tight">
              Make every construction claim prove itself.
            </h2>

            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              Eliminate progress fiction, challan over-billing, and off-site material diversion. Deploy CONSTRA across your active civil works today.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0b0d11] font-mono font-bold text-xs uppercase tracking-wider px-8 py-4 rounded shadow-lg shadow-amber-400/20 flex items-center justify-center space-x-2 transition-all"
              >
                <span>ENTER CONSTRA PORTAL</span>
                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
              </Link>
              <button
                onClick={() => scrollToSection("protocol")}
                className="w-full sm:w-auto border border-white/20 hover:border-white/50 active:scale-[0.98] text-white hover:text-amber-300 font-mono text-xs uppercase tracking-wider px-8 py-4 rounded transition-all cursor-pointer"
                type="button"
              >
                REVIEW AUDIT PROTOCOL
              </button>
            </div>

            {/* Performance Metrics Ticker */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-12 border-t border-white/10 font-mono text-xs">
              <div className="p-4 rounded bg-white/5 border border-white/5">
                <span className="text-slate-400 block mb-1">SYSTEM UPTIME</span>
                <span className="text-emerald-400 font-bold text-lg tabular-nums">99.98%</span>
              </div>
              <div className="p-4 rounded bg-white/5 border border-white/5">
                <span className="text-slate-400 block mb-1">OCR EXTRACTION LATENCY</span>
                <span className="text-amber-400 font-bold text-lg tabular-nums">&lt; 3.2 SEC</span>
              </div>
              <div className="p-4 rounded bg-white/5 border border-white/5">
                <span className="text-slate-400 block mb-1">GPS CEP ACCURACY</span>
                <span className="text-white font-bold text-lg tabular-nums">± 1.4 METERS</span>
              </div>
              <div className="p-4 rounded bg-white/5 border border-white/5">
                <span className="text-slate-400 block mb-1">TAMPER DETECTION</span>
                <span className="text-emerald-400 font-bold text-lg tabular-nums">SHA-256 SEAL</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 8. ARCHITECTURAL FOOTER                                                   */}
      {/* ========================================================================= */}
      <footer className="relative z-10 border-t border-white/10 bg-[#08090c] text-slate-400 font-mono text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-xs bg-amber-400" />
              <span className="font-bold text-white tracking-wider">CONSTRA PLATFORM</span>
            </div>
            <span className="hidden sm:inline-block text-slate-600">//</span>
            <span className="text-[11px] text-slate-400">
              CIVIL AUDIT &amp; MILESTONE VERIFICATION STANDARD
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px]">
            <span className="text-slate-400">SPEC ASTM-E2018</span>
            <span className="text-slate-400">LAT 40.7128° N, 74.0060° W</span>
            <span className="text-slate-300">© 2025 CONSTRA ENGINEERING</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
