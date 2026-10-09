import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleHomeRoute } from "../auth/ProtectedRoute";
import TechText from "../components/TechText";

const CHAPTERS = [
  {
    id: 0,
    tag: "CHAPTER 00 // INITIAL STATE",
    ref: "REF: SECTOR-00 // FOUNDATION AUDIT",
    coordinates: "LAT 40.7128°N / LONG 74.0060°W // ELEV 14.2M",
    title: "CONSTRA",
    quote: "“Every claim proves itself.”",
    description:
      "Site photos, delivery challans and material issues, checked against the plan before a milestone is cleared.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDw-IYTv19maw4jyLXRfSz6L3NN88vDTeb9amS7BMKCIedvujHg4CF5LfHipkjGLvvKYzaMwoBapF7R3iJ0I0BUZD0MgF5tJmQ9z6yAy9CEOwYtOYmcp1xHslhPzY8IitiCBwlnQIXZVfeur8Menlm0thuAV17dPQKB7rgt7ZG9LCCWxOBSmRUNK1Q-6nrn-1IGdARRNq2hlrKZWM68mXMBK6NKYlKrBt7kUXY6zgMsncrIkFJCF9se",
    alt: "Raw concrete skeleton and yellow tower crane against dawn overcast sky",
    telemetry: null,
    nextLabel: "NEXT: CAPTURE →",
  },
  {
    id: 1,
    tag: "CHAPTER 01 // CAPTURE",
    ref: "STAGE // TELEMETRY LINKED",
    coordinates: "EXIF GPS LOCK // RTK PRECISION",
    title: "Capture it live.",
    quote: null,
    description:
      "Photos are taken on site, with location and time recorded at the moment of capture. No retrospective gallery uploads. No spoofed coordinates.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCSOPH9RMbvNjAjCYxJIDGtXOz8-5IB9Zm-wXVMpVR_wzjeySmyctPSCy8V0C5VnBarlyYQ2yETPNfM4y7rJQKNDzaSMbqtfXegnOxXhpyFhGgc1WFd-WxGGOYZMubgjP0Hw1e1NSCZd47ifRr3mTnqxO4Fj5-Qhmohawriod46MpABjZWicbvYV772V1iBAD8JSJIFnscrmH1FpqgYtJC_y7iK-LtSVL__qsPaygPBR15RJvuPL4fL",
    alt: "Field engineer phone photographing cast-in-place concrete wall",
    telemetry: {
      leftLabel: "EXIF TIMESTAMP",
      leftValue: "14:22:09.102 UTC",
      rightLabel: "GEOLOCATION RADIUS",
      rightValue: "± 1.4 METERS CEP",
    },
    nextLabel: "NEXT: MATCH →",
  },
  {
    id: 2,
    tag: "CHAPTER 02 // MATCH",
    ref: "BILL OF QUANTITIES // CROSS-CHECK",
    coordinates: "OCR CHALLAN INTAKE // 0.00% VARIANCE",
    title: "Match every delivery.",
    quote: null,
    description:
      "Delivery challans are read automatically and compared with the Bill of Quantities. Material issued is checked against verified work.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC3dYa2PliG7TfDMt8SU77M_Nn-jR7S0qpynTj1mg1Ku8e3ZwwLTbymC5SFlWnhb0TFWTZW8RM0PKhLGoaOL6ufIrALyTDgHDV-aneuP0-wbDzN4WpdOrv0EWxiMKlnbcgVIGOpDRv7LQgkOg8Ts94SKIZO5pd3xzi4smJdLm773cZSkOCILfqoAnj0HmBSE2cHR4F99_SB8BP_ONnwnIEnxn0Vik4MJchflSGCEsTJiT0855waVZ5f",
    alt: "Pallets of Portland cement bags, steel rebar bundles and receipt clipboard",
    telemetry: {
      leftLabel: "REBAR FE-550D PO#",
      leftValue: "CH-9812 // 24.5 MT",
      rightLabel: "BOQ SCHEDULE DELTA",
      rightValue: "0.00% VARIANCE",
    },
    nextLabel: "NEXT: APPROVE →",
  },
  {
    id: 3,
    tag: "CHAPTER 03 // APPROVE",
    ref: "AUDIT CONVERGENCE GATE",
    coordinates: "EVIDENCE TRIAGE // MULTI-SIG CLEARANCE",
    title: "Approve with proof.",
    quote: null,
    description:
      "Flags arrive with their evidence. A milestone clears only when every check agrees. No informal sign-offs or verbal assumptions.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAjv0HUu3DK1vCs8biTraWx8_JyzGL0sr_u6hr8FOSY-638kmA5nf7I8esvk_xspKN3HwYjsNpG4EhpWNXJKjMwVgchCCxAOSayMnnmT1nVetEVTcninfo38c-JdcM2uUc0pp0UoeefTZMqq9OYhNS5nfCbiKqNYZZS6QHC6i-BUPnKDciAMSRqIcSd3wz0OJCluw-mIoNLlZfK3Bz8_RY71Qa4FKJOkP7W_YoUzlYjyAw8wiMeCy2b",
    alt: "Civil engineer audit desk overlooking construction floor with blueprints",
    telemetry: {
      leftLabel: "AUDIT CONSENSUS",
      leftValue: "ZERO UNRESOLVED FLAGS",
      rightLabel: "GATE STATUS",
      rightValue: "STRUCTURAL CONSENSUS OK",
    },
    nextLabel: "NEXT: SEAL →",
  },
  {
    id: 4,
    tag: "CHAPTER 04 // SEAL",
    ref: "TAMPER-EVIDENT RECORD SEAL",
    coordinates: "CRYPTOGRAPHIC LEDGER // IMMUTABLE",
    title: "Verified once. Locked.",
    quote: null,
    description:
      "Every cleared milestone is sealed in a tamper-evident record that cannot be edited later. An immutable digital chain of physical execution.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAeLindz1DdFCB2MQu6_CFeBiX2oTTA546IysHglQ5ubrcz-C0IUyr-8zxSxvfbYQFXzXrpwamQRD9hS2LAZbVK8ej5w--WTU6cTDbnWUr7oxO39G30rsWu65HJJtmZQVVzSu94M9SGKFOnlLjq3jDiwWzYyTqFrTlUV3lW0kU3Aw3O66b4JFpKvxQSh2cVD3geX35yMb0jkjtC8TMJCOunin5lIAWFd_Zmr5NxwY_thvr8HPK5R43P",
    alt: "Industrial steel padlock clamped to structural rebar with yellow inspection tag",
    telemetry: null,
    nextLabel: "← REPLAY SEQUENCE",
  },
];

export const LandingPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [demoFlagResolved, setDemoFlagResolved] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keyboard navigation for carousel
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

  return (
    <div className="bg-[#E6E2DD] text-on-surface min-h-screen relative font-body-md text-body-md selection:bg-[#FCBC18] selection:text-[#101010]">
      {/* Blueprint Hairline Coordinate Grid Lines */}
      <div className="pointer-events-none fixed inset-0 z-0 grid grid-cols-12 gap-4 px-6 opacity-[0.06]">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-full border-r border-[#101010]" />
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. PERSISTENT ARCHITECTURAL HEADER                                        */}
      {/* ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#101010] text-[#F2ECE6] border-b border-[#101010] shadow-[0_3px_0px_#101010]">
        <div className="h-18 w-full px-6 md:px-10 flex items-center justify-between">
          {/* Brand Mark */}
          <div className="flex items-center space-x-4">
            <div className="w-2.5 h-2.5 bg-[#FCBC18] shrink-0" />
            <span className="font-label-code text-label-code tracking-[0.2em] text-[#A39B8F] border border-[#A39B8F]/30 px-2 py-0.5">
              SYS // 01
            </span>
            <button
              onClick={() => scrollToSection("overview")}
              className="font-headline-md text-headline-md tracking-wider text-[#F2ECE6] uppercase font-bold hover:text-[#FCBC18] transition-colors cursor-pointer"
            >
              CONSTRA
            </button>
            <div className="hidden lg:block h-4 w-px bg-[#A39B8F]/30" />
            <span className="hidden lg:inline-block font-label-meta text-label-meta text-[#A39B8F] uppercase tracking-[0.14em]">
              CIVIL AUDIT PLATFORM
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection("leakage-vectors")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              Vectors
            </button>
            <button
              onClick={() => scrollToSection("protocol")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              Protocol
            </button>
            <button
              onClick={() => scrollToSection("evidence-check")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              Inspection
            </button>
            <button
              onClick={() => scrollToSection("roles")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              Roles
            </button>
            <button
              onClick={() => scrollToSection("spec-2025")}
              className="px-3.5 py-1.5 font-label-code text-label-code uppercase tracking-[0.14em] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors border border-transparent hover:border-[#101010] cursor-pointer"
            >
              Spec // 2025
            </button>
          </nav>

          {/* Operational State & Authentication Action */}
          <div className="flex items-center space-x-4">
            <div className="hidden xl:flex items-center space-x-2 border border-[#A39B8F]/30 px-2.5 py-1">
              <div className="w-2 h-2 bg-tertiary-fixed-dim animate-pulse" />
              <span className="font-label-code text-label-code text-[#F2ECE6] uppercase">
                GATE: OPERATIONAL
              </span>
            </div>

            <div className="hidden sm:inline-block border border-[#A39B8F]/40 px-2.5 py-1 font-label-code text-label-code uppercase text-[#FCBC18]">
              SPEC V1.04
            </div>

            {user ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate(getRoleHomeRoute(user.role))}
                  className="bg-[#FCBC18] text-[#101010] px-3.5 py-1.5 font-label-code text-label-code uppercase font-bold tracking-wider hover:bg-[#F2ECE6] transition-colors shadow-[2px_2px_0px_#101010] flex items-center space-x-1 cursor-pointer"
                >
                  <span>PORTAL CONSOLE</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
                <div className="w-8 h-8 rounded-none border border-[#FCBC18] bg-[#101010] flex items-center justify-center font-label-code text-xs text-[#FCBC18] font-bold">
                  {user.role ? user.role.slice(0, 2).toUpperCase() : "US"}
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="border border-[#F2ECE6] px-4 py-1.5 font-label-code text-label-code uppercase text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors shadow-[2px_2px_0px_#FCBC18] font-bold"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full pt-18" id="overview">
        {/* ========================================================================= */}
        {/* 2. PINNED CHAPTER SEQUENCE / TECHNICAL VISUAL NARRATIVE                   */}
        {/* ========================================================================= */}
        <section
          id="how-it-works"
          className="relative w-full bg-[#101010] text-[#F2ECE6] overflow-hidden select-none"
        >
          {/* Continuous Looping Background Video */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover object-center grayscale contrast-125 brightness-75"
            >
              <source src="/gemini_generated_video_cc806917.mp4" type="video/mp4" />
            </video>
            {/* Scrim gradient layers for text legibility & technical grading */}
            <div className="absolute inset-0 bg-linear-to-r from-[#101010] via-[#101010]/85 to-transparent w-full md:w-3/5" />
            <div className="absolute inset-0 bg-[#101010]/25 mix-blend-multiply" />
          </div>

          {/* Coordinate Datum Grid Lines */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-12 opacity-15 z-10">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-full border-r border-[#A39B8F]" />
            ))}
          </div>

          {/* Right-Edge Vertical Progress Rail */}
          <aside
            aria-label="Sequence progression"
            className="absolute right-0 top-0 bottom-0 z-30 w-12 md:w-16 border-l border-[#A39B8F]/30 bg-[#101010]/90 flex flex-col justify-between py-8 items-center font-label-code text-label-code"
          >
            <div className="text-[#FCBC18] tracking-widest [writing-mode:vertical-rl] uppercase text-[10px]">
              SEQ // RUNTIME
            </div>
            <div className="flex flex-col items-center space-y-6 w-full px-2" id="rail-markers">
              {CHAPTERS.map((chap, idx) => {
                const isActive = idx === currentSlide;
                return (
                  <button
                    key={chap.id}
                    onClick={() => goToSlide(idx)}
                    className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                    type="button"
                    title={`Go to ${chap.tag}`}
                  >
                    <span
                      className={`text-[11px] font-bold transition-colors ${isActive ? "text-[#FCBC18]" : "text-[#A39B8F] group-hover:text-[#FCBC18]"
                        }`}
                    >
                      0{idx}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 transition-all ${isActive
                          ? "bg-[#FCBC18]"
                          : "bg-[#A39B8F]/30 group-hover:bg-[#FCBC18]"
                        }`}
                    />
                  </button>
                );
              })}
            </div>
            <div className="text-[#A39B8F] text-[10px] [writing-mode:vertical-rl]">
              CAL. 2025 // SEC
            </div>
          </aside>

          {/* Slide Viewport Container */}
          <div className="relative w-full h-160 md:h-180 pr-12 md:pr-16" id="slides-wrapper">
            {CHAPTERS.map((chapter, idx) => {
              const isActive = idx === currentSlide;
              return (
                <article
                  key={chapter.id}
                  className={`slide-panel absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out ${isActive ? "opacity-100 z-20" : "opacity-0 pointer-events-none z-10"
                    }`}
                >
                  <div className="relative w-full h-full flex items-stretch">
                    {/* Technical Drafting Overlays & Corner Registration Ticks */}
                    <div className="absolute top-6 left-6 z-20 flex items-center space-x-3 pointer-events-none">
                      <div className="w-3 h-3 border-t-2 border-l-2 border-[#FCBC18]" />
                      <span className="font-label-code text-label-code tracking-widest text-[#FCBC18] uppercase">
                        {chapter.ref}
                      </span>
                    </div>
                    <div className="absolute bottom-6 left-6 z-20 flex items-center space-x-3 pointer-events-none">
                      <div className="w-3 h-3 border-b-2 border-l-2 border-[#FCBC18]" />
                      <span className="font-label-meta text-label-meta text-[#A39B8F] tracking-widest uppercase">
                        {chapter.coordinates}
                      </span>
                    </div>

                    {/* Content Block */}
                    <div className="relative z-10 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-3xl">
                      <div className="inline-flex items-center space-x-2 border border-[#FCBC18] px-2.5 py-1 mb-6 bg-[#101010] w-max">
                        <span className="w-2 h-2 bg-[#FCBC18]" />
                        <span className="font-label-code text-label-code uppercase tracking-widest text-[#FCBC18]">
                          {chapter.tag}
                        </span>
                      </div>

                      {chapter.title === "CONSTRA" ? (
                        <div className="w-full max-w-2xl h-24 sm:h-28 md:h-36 mb-4 relative -ml-3">
                          <h1 className="sr-only">{chapter.title}</h1>
                          <TechText
                            text="CONSTRA"
                            fontFamily="'Space Grotesk', sans-serif"
                            fontWeight={700}
                            fontSize={130}
                            color="#F2ECE6"
                            accentColor="#FCBC18"
                            letterSpacing={0.02}
                            reach={180}
                            softness={0.7}
                            dashLength={4}
                            dashGap={2}
                            strokeWidth={1.5}
                            speed={0.8}
                            lineStyle="dashed"
                            reveal="letter"
                            specks={15}
                            selection={true}
                            labels={true}
                            draggable={true}
                            sweep={isActive}
                            sweepMode="restart"
                            align="left"
                          />
                        </div>
                      ) : (
                        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-[#F2ECE6] tracking-tight uppercase leading-none font-bold mb-4">
                          {chapter.title}
                        </h1>
                      )}

                      {chapter.quote && (
                        <div className="border-l-4 border-[#FCBC18] pl-4 mb-6">
                          <p className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[#FCBC18] font-bold tracking-wide uppercase">
                            {chapter.quote}
                          </p>
                        </div>
                      )}

                      <p className="font-body-lg text-body-lg text-[#E6E2DD] max-w-xl font-normal leading-relaxed mb-8">
                        {chapter.description}
                      </p>

                      {/* Optional Chapter Telemetry Box */}
                      {chapter.telemetry && (
                        <div className="grid grid-cols-2 gap-4 max-w-md border border-[#A39B8F]/30 p-4 bg-[#101010]/80 mb-8 font-label-code">
                          <div>
                            <span className="font-label-meta text-label-meta text-[#A39B8F] uppercase block mb-1">
                              {chapter.telemetry.leftLabel}
                            </span>
                            <span className="font-label-code text-label-code text-[#F2ECE6] font-bold">
                              {chapter.telemetry.leftValue}
                            </span>
                          </div>
                          <div>
                            <span className="font-label-meta text-label-meta text-[#A39B8F] uppercase block mb-1">
                              {chapter.telemetry.rightLabel}
                            </span>
                            <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                              {chapter.telemetry.rightValue}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Interactive Buttons */}
                      <div className="flex flex-wrap items-center gap-4">
                        {idx === 0 ? (
                          <>
                            <Link
                              to="/login"
                              className="bg-[#FCBC18] text-[#101010] font-label-code text-label-code uppercase tracking-wider px-6 py-3 border border-[#101010] hover:bg-[#F2ECE6] transition-all font-bold shadow-[3px_3px_0px_#101010]"
                            >
                              INITIALIZE VERIFICATION
                            </Link>
                            <button
                              onClick={() => goToSlide(1)}
                              className="bg-transparent text-[#F2ECE6] border border-[#F2ECE6] font-label-code text-label-code uppercase tracking-wider px-6 py-3 hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors cursor-pointer"
                              type="button"
                            >
                              NEXT: CAPTURE →
                            </button>
                          </>
                        ) : idx === CHAPTERS.length - 1 ? (
                          <>
                            <button
                              onClick={() => goToSlide(0)}
                              className="bg-[#FCBC18] text-[#101010] font-label-code text-label-code uppercase tracking-wider px-6 py-3 border border-[#101010] hover:bg-[#F2ECE6] transition-all font-bold shadow-[3px_3px_0px_#101010] cursor-pointer"
                              type="button"
                            >
                              ← REPLAY SEQUENCE
                            </button>
                            <button
                              onClick={() => scrollToSection("protocol")}
                              className="border border-[#F2ECE6] text-[#F2ECE6] font-label-code text-label-code uppercase tracking-wider px-6 py-3 hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors cursor-pointer"
                              type="button"
                            >
                              VIEW ARCHITECTURE ↓
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => goToSlide((idx + 1) % CHAPTERS.length)}
                            className="bg-[#FCBC18] text-[#101010] font-label-code text-label-code uppercase tracking-wider px-6 py-3 border border-[#101010] hover:bg-[#101010] hover:text-[#FCBC18] hover:border-[#FCBC18] transition-all font-bold shadow-[3px_3px_0px_#101010] cursor-pointer"
                            type="button"
                          >
                            {chapter.nextLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. SECTION 5.3: WHERE CLAIMS LEAK (Paper Ground #E6E2DD)                   */}
        {/* ========================================================================= */}
        <section
          id="leakage-vectors"
          className="w-full bg-[#E6E2DD] text-[#101010] px-6 md:px-12 lg:px-20 py-20 border-t border-[#A39B8F]/30"
        >
          <div className="w-full max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="w-full pb-8 border-b border-[#A39B8F]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <span className="font-label-code text-label-code text-[#101010] bg-[#FCBC18] px-2 py-0.5 font-bold uppercase tracking-widest border border-[#101010]">
                  01 / LEAKAGE VECTORS
                </span>
                <span className="font-label-meta text-label-meta text-[#8C8B91] uppercase tracking-[0.18em]">
                  SYSTEMIC CAPITAL EROSION ANALYSIS
                </span>
              </div>
              <div className="font-label-code text-label-code text-[#8C8B91]">
                SPEC REF: CS-VEC-09
              </div>
            </div>

            {/* 12-Column Blueprint Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-12 items-start">
              {/* Sticky Left Block (5 columns) */}
              <div className="lg:col-span-5 lg:sticky lg:top-28">
                <div className="relative pl-6 border-l-2 border-[#101010]">
                  <span className="font-label-code text-label-code text-[#8C8B91] uppercase tracking-widest block mb-2">
                    FINANCIAL INTEGRITY HAZARDS
                  </span>
                  <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase font-bold text-[#101010] tracking-tight leading-tight mb-4">
                    Three ways a site loses money.
                  </h2>
                  <p className="font-body-lg text-body-lg text-[#5F5E5E] leading-relaxed">
                    Discrepancies in civil works compound silently. By decoupling billing events from verifiable physical stage completions, owners absorb structural margin bleed that remains undetected until final reconciliations.
                  </p>
                  <div className="mt-8 border border-[#A39B8F]/40 p-4 bg-[#F2ECE6]">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="material-symbols-outlined text-[#B3261E]">warning</span>
                      <span className="font-label-code text-label-code uppercase tracking-wider font-bold">
                        UNVERIFIED RISK MULTIPLIER
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-[#5F5E5E]">
                      Average unvetted subcontractor claims generate 7.4% to 11.2% in phantom overhead per structural tier.
                    </p>
                  </div>
                </div>
              </div>

              {/* Spec Table Right Block (7 columns) */}
              <div className="lg:col-span-7 bg-[#F2ECE6] border border-[#A39B8F]/40 relative">
                {/* Drafting Corner Ticks */}
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

                {/* Table Header */}
                <div className="grid grid-cols-12 bg-[#101010] text-[#F2ECE6] px-4 py-3 font-label-meta text-label-meta uppercase tracking-widest">
                  <div className="col-span-3">VECTOR // LEAK</div>
                  <div className="col-span-5 pl-2 border-l border-[#A39B8F]/30">HOW IT HAPPENS</div>
                  <div className="col-span-4 pl-2 border-l border-[#A39B8F]/30">CONSTRA INTERCEPT</div>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-12 px-4 py-6 border-b border-[#A39B8F]/30 hover:bg-[#E6E2DD]/50 transition-colors">
                  <div className="col-span-12 md:col-span-3 mb-2 md:mb-0">
                    <span className="font-label-code text-label-code text-[#B3261E] bg-error-container px-1.5 py-0.5 inline-block font-bold mb-1 border border-[#B3261E]/30">
                      VEC-01
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase">
                      Fake progress
                    </h3>
                  </div>
                  <div className="col-span-12 md:col-span-5 md:pl-2 md:border-l border-[#A39B8F]/30 mb-2 md:mb-0 font-body-md text-body-md text-[#5F5E5E]">
                    Old or borrowed photos billed as new work across adjacent structural units or repeated floors.
                  </div>
                  <div className="col-span-12 md:col-span-4 md:pl-2 md:border-l border-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
                    <span className="text-[#2F6F4E] font-bold">✓</span> Location coordinates, capture timestamp, and visual stage match.
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-12 px-4 py-6 border-b border-[#A39B8F]/30 hover:bg-[#E6E2DD]/50 transition-colors">
                  <div className="col-span-12 md:col-span-3 mb-2 md:mb-0">
                    <span className="font-label-code text-label-code text-[#B3261E] bg-error-container px-1.5 py-0.5 inline-block font-bold mb-1 border border-[#B3261E]/30">
                      VEC-02
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase">
                      Inflated paperwork
                    </h3>
                  </div>
                  <div className="col-span-12 md:col-span-5 md:pl-2 md:border-l border-[#A39B8F]/30 mb-2 md:mb-0 font-body-md text-body-md text-[#5F5E5E]">
                    Delivery slips and dispatch notes that do not match the engineered plan or physical bills of quantities.
                  </div>
                  <div className="col-span-12 md:col-span-4 md:pl-2 md:border-l border-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
                    <span className="text-[#2F6F4E] font-bold">✓</span> Automated OCR challan delta against approved Bill of Quantities.
                  </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-12 px-4 py-6 hover:bg-[#E6E2DD]/50 transition-colors">
                  <div className="col-span-12 md:col-span-3 mb-2 md:mb-0">
                    <span className="font-label-code text-label-code text-[#B3261E] bg-error-container px-1.5 py-0.5 inline-block font-bold mb-1 border border-[#B3261E]/30">
                      VEC-03
                    </span>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase">
                      Diverted material
                    </h3>
                  </div>
                  <div className="col-span-12 md:col-span-5 md:pl-2 md:border-l border-[#A39B8F]/30 mb-2 md:mb-0 font-body-md text-body-md text-[#5F5E5E]">
                    More raw bulk material issued from storage yards than the verified structural element physically requires.
                  </div>
                  <div className="col-span-12 md:col-span-4 md:pl-2 md:border-l border-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
                    <span className="text-[#2F6F4E] font-bold">✓</span> Store issue reconciliation mapped directly to proven progress.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. SECTION 5.4: HOW VERIFICATION WORKS (Dark Ink Section #101010)         */}
        {/* ========================================================================= */}
        <section
          id="protocol"
          className="w-full bg-[#101010] text-[#F2ECE6] px-6 md:px-12 lg:px-20 py-20 border-t border-[#A39B8F]/20 relative"
        >
          {/* Section Header Block */}
          <div className="w-full max-w-7xl mx-auto pb-8 border-b border-[#A39B8F]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <span className="font-label-code text-label-code text-[#101010] bg-[#FCBC18] px-2 py-0.5 font-bold uppercase tracking-widest border border-[#101010]">
                02 / PROTOCOL
              </span>
              <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[#F2ECE6] uppercase font-bold tracking-tight">
                How verification works
              </h2>
            </div>
            <div className="flex items-center space-x-2 font-label-code text-label-code text-[#FCBC18]">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span>5-STAGE ASYNC PIPELINE</span>
            </div>
          </div>

          {/* Five-Step Horizontal Pipeline */}
          <div className="w-full max-w-7xl mx-auto mt-16">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
              {/* Step 1: CAPTURE */}
              <div className="relative flex flex-col border border-[#A39B8F]/30 p-5 bg-[#101010] group hover:border-[#FCBC18] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    NODE 01
                  </span>
                  <div className="w-4 h-4 bg-[#FCBC18] flex items-center justify-center text-[#101010] font-bold text-[10px]">
                    1
                  </div>
                </div>
                <div className="h-10 flex items-center mb-2">
                  <span className="material-symbols-outlined text-[#FCBC18] text-3xl">
                    photo_camera
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#F2ECE6] mb-2 tracking-wide">
                  CAPTURE
                </h3>
                <p className="font-body-md text-body-md text-[#A39B8F] leading-relaxed">
                  Geo-tagged photo timestamped at upload. Physical coordinates anchored to site polygon.
                </p>
                <div className="mt-6 pt-3 border-t border-[#A39B8F]/20 font-label-meta text-label-meta text-[#8C8B91] uppercase">
                  INPUT: RAW SITE EXIF
                </div>
              </div>

              {/* Step 2: READ */}
              <div className="relative flex flex-col border border-[#A39B8F]/30 p-5 bg-[#101010] group hover:border-[#FCBC18] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    NODE 02
                  </span>
                  <div className="w-4 h-4 bg-[#FCBC18] flex items-center justify-center text-[#101010] font-bold text-[10px]">
                    2
                  </div>
                </div>
                <div className="h-10 flex items-center mb-2">
                  <span className="material-symbols-outlined text-[#FCBC18] text-3xl">
                    document_scanner
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#F2ECE6] mb-2 tracking-wide">
                  READ
                </h3>
                <p className="font-body-md text-body-md text-[#A39B8F] leading-relaxed">
                  OCR extracts item, grade and quantity from physical delivery challan paper slips.
                </p>
                <div className="mt-6 pt-3 border-t border-[#A39B8F]/20 font-label-meta text-label-meta text-[#8C8B91] uppercase">
                  PARSER: TABULAR OCR
                </div>
              </div>

              {/* Step 3: RECONCILE */}
              <div className="relative flex flex-col border border-[#A39B8F]/30 p-5 bg-[#101010] group hover:border-[#FCBC18] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    NODE 03
                  </span>
                  <div className="w-4 h-4 bg-[#FCBC18] flex items-center justify-center text-[#101010] font-bold text-[10px]">
                    3
                  </div>
                </div>
                <div className="h-10 flex items-center mb-2">
                  <span className="material-symbols-outlined text-[#FCBC18] text-3xl">
                    balance
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#F2ECE6] mb-2 tracking-wide">
                  RECONCILE
                </h3>
                <p className="font-body-md text-body-md text-[#A39B8F] leading-relaxed">
                  Automated delta check against engineering plan and structural Bill of Quantities.
                </p>
                <div className="mt-6 pt-3 border-t border-[#A39B8F]/20 font-label-meta text-label-meta text-[#8C8B91] uppercase">
                  MATCH: SCHEDULE BOQ
                </div>
              </div>

              {/* Step 4: FLAG */}
              <div className="relative flex flex-col border border-[#A39B8F]/30 p-5 bg-[#101010] group hover:border-[#FCBC18] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    NODE 04
                  </span>
                  <div className="w-4 h-4 bg-[#FCBC18] flex items-center justify-center text-[#101010] font-bold text-[10px]">
                    4
                  </div>
                </div>
                <div className="h-10 flex items-center mb-2">
                  <span className="material-symbols-outlined text-[#FCBC18] text-3xl">
                    report
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#F2ECE6] mb-2 tracking-wide">
                  FLAG
                </h3>
                <p className="font-body-md text-body-md text-[#A39B8F] leading-relaxed">
                  Anomalies routed directly to site auditor with physical evidence dossiers.
                </p>
                <div className="mt-6 pt-3 border-t border-[#A39B8F]/20 font-label-meta text-label-meta text-[#8C8B91] uppercase">
                  ROUTING: AUDIT CHAIR
                </div>
              </div>

              {/* Step 5: CLEAR */}
              <div className="relative flex flex-col border border-[#A39B8F]/30 p-5 bg-[#101010] group hover:border-[#FCBC18] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    NODE 05
                  </span>
                  <div className="w-4 h-4 bg-[#FCBC18] flex items-center justify-center text-[#101010] font-bold text-[10px]">
                    5
                  </div>
                </div>
                <div className="h-10 flex items-center mb-2">
                  <span className="material-symbols-outlined text-[#FCBC18] text-3xl">
                    lock
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#F2ECE6] mb-2 tracking-wide">
                  CLEAR
                </h3>
                <p className="font-body-md text-body-md text-[#A39B8F] leading-relaxed">
                  Milestone sealed and cryptographically locked. State permanently frozen.
                </p>
                <div className="mt-6 pt-3 border-t border-[#A39B8F]/20 font-label-meta text-label-meta text-[#8C8B91] uppercase">
                  LEDGER: SEAL RECORD
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. SECTION 5.5: EVIDENCE CHECK SAMPLE PANEL (Warm Ivory #F2ECE6)          */}
        {/* ========================================================================= */}
        <section
          id="evidence-check"
          className="w-full bg-[#E6E2DD] text-[#101010] px-6 md:px-12 lg:px-20 py-24 border-t border-[#A39B8F]/30"
        >
          <div className="w-full max-w-4xl mx-auto">
            {/* Panel Header Lead-in */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <span className="font-label-code text-label-code uppercase tracking-widest text-[#8C8B91] block mb-1">
                  RUN-TIME AUDIT TELEMETRY
                </span>
                <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
                  Evidence Check Inspection
                </h2>
              </div>
              <div className="font-label-meta text-label-meta text-[#8C8B91] uppercase tracking-wider flex items-center space-x-2">
                <span className="w-2 h-2 bg-[#2F6F4E] inline-block" />
                <span>LIVE SPECIMEN RECORD // DEMO ENGINE</span>
              </div>
            </div>

            {/* Evidence Card Panel */}
            <div className="bg-[#F2ECE6] border border-[#A39B8F]/40 p-6 md:p-10 shadow-[0_30px_60px_-30px_rgba(16,16,16,0.35)] relative">
              {/* Engineered Corner Crop Ticks */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-[#FCBC18]" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-[#FCBC18]" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-[#FCBC18]" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-[#FCBC18]" />

              {/* Card Title Bar & Badges */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#A39B8F]/40 gap-4">
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 bg-[#FCBC18]" />
                  <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#101010] tracking-wide">
                    SAMPLE: Slab Casting // Level 04
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="font-label-code text-label-code bg-[#E6E2DD] border border-[#101010] px-2.5 py-1 text-[#101010] uppercase font-bold">
                    SPECIMEN: SEC-04
                  </span>
                  <span
                    className={`font-label-code text-label-code px-2.5 py-1 uppercase font-bold border border-[#101010] transition-colors ${demoFlagResolved
                        ? "bg-[#2F6F4E] text-[#F2ECE6]"
                        : "bg-[#FCBC18] text-[#101010]"
                      }`}
                  >
                    STATUS: {demoFlagResolved ? "VERIFIED & CLEARED" : "FLAGGED"}
                  </span>
                </div>
              </div>

              {/* 3 Check Rows */}
              <div className="divide-y divide-[#A39B8F]/30 my-6">
                {/* Row 1: Location */}
                <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#101010] text-[#F2ECE6] flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">pin_drop</span>
                    </div>
                    <div>
                      <span className="font-label-code text-label-code uppercase text-[#8C8B91] block">
                        CHECK PARAMETER 01
                      </span>
                      <span className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
                        Location Proximity
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 sm:text-right">
                    <div className="font-label-code text-label-code text-[#5F5E5E]">
                      READING: <span className="text-[#101010] font-bold">42 m from centroid</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-[#2F6F4E] text-[#F2ECE6] px-3 py-1 font-label-code text-label-code uppercase font-bold">
                      <span className="material-symbols-outlined text-sm">check_box</span>
                      <span>PASS</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Capture Time */}
                <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#101010] text-[#F2ECE6] flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">schedule</span>
                    </div>
                    <div>
                      <span className="font-label-code text-label-code uppercase text-[#8C8B91] block">
                        CHECK PARAMETER 02
                      </span>
                      <span className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
                        Capture Time Latency
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 sm:text-right">
                    <div className="font-label-code text-label-code text-[#5F5E5E]">
                      READING: <span className="text-[#101010] font-bold">3 min before upload</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-[#2F6F4E] text-[#F2ECE6] px-3 py-1 font-label-code text-label-code uppercase font-bold">
                      <span className="material-symbols-outlined text-sm">check_box</span>
                      <span>PASS</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Stage match (Interactive Flagged state) */}
                <div
                  className={`py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-3 -mx-3 border-l-4 transition-all ${demoFlagResolved
                      ? "border-[#2F6F4E] bg-[#2F6F4E]/10"
                      : "border-[#FCBC18] bg-[#FCBC18]/10"
                    }`}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-8 h-8 flex items-center justify-center ${demoFlagResolved
                          ? "bg-[#2F6F4E] text-[#F2ECE6]"
                          : "bg-[#101010] text-[#FCBC18]"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {demoFlagResolved ? "verified" : "layers"}
                      </span>
                    </div>
                    <div>
                      <span className="font-label-code text-label-code uppercase text-[#8C8B91] block">
                        CHECK PARAMETER 03
                      </span>
                      <span className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
                        Stage Morphology Match
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 sm:text-right">
                    <div className="font-label-code text-label-code text-[#101010]">
                      {demoFlagResolved ? (
                        <span>
                          REMEDIATION:{" "}
                          <span className="text-[#2F6F4E] font-bold">
                            Rebar mesh verified by secondary inspector
                          </span>
                        </span>
                      ) : (
                        <span>
                          REASON:{" "}
                          <span className="font-bold underline decoration-[#B3261E]">
                            No reinforcement visible
                          </span>
                        </span>
                      )}
                    </div>
                    <div
                      className={`flex items-center space-x-1.5 px-3 py-1 font-label-code text-label-code uppercase font-bold border border-[#101010] ${demoFlagResolved
                          ? "bg-[#2F6F4E] text-[#F2ECE6]"
                          : "bg-[#FCBC18] text-[#101010]"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {demoFlagResolved ? "check_circle" : "warning"}
                      </span>
                      <span>{demoFlagResolved ? "RESOLVED" : "FLAGGED"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Footer / Interactive Simulation Toggle */}
              <div className="mt-8 pt-6 border-t border-[#A39B8F]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="font-label-code text-label-code text-[#5F5E5E]">
                  AUDIT DECISION:{" "}
                  {demoFlagResolved ? (
                    <span className="text-[#2F6F4E] font-bold">
                      CLEARANCE GRANTED // CERTIFICATE UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[#B3261E] font-bold">
                      CERTIFICATE ISSUANCE HALTED
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button
                    onClick={() => setDemoFlagResolved(!demoFlagResolved)}
                    className="w-full sm:w-auto bg-[#E6E2DD] text-[#101010] px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold border border-[#101010] hover:bg-[#101010] hover:text-[#FCBC18] transition-colors cursor-pointer"
                    type="button"
                  >
                    {demoFlagResolved ? "Re-open Defect Flag" : "Simulate Auditor Review"}
                  </button>

                  <button
                    disabled={!demoFlagResolved}
                    onClick={() => navigate("/login")}
                    className={`w-full sm:w-auto px-6 py-3 font-label-code text-label-code uppercase tracking-wider font-bold border border-[#101010] flex items-center justify-center space-x-2 transition-all ${demoFlagResolved
                        ? "bg-[#FCBC18] text-[#101010] cursor-pointer shadow-[2px_2px_0px_#101010] hover:bg-[#101010] hover:text-[#FCBC18]"
                        : "bg-[#101010] text-[#FCBC18] cursor-not-allowed shadow-[2px_2px_0px_#B3261E]"
                      }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">
                      {demoFlagResolved ? "key" : "lock"}
                    </span>
                    <span>
                      {demoFlagResolved ? "Proceed to Signoff" : "Blocked: 1 open flag"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. SECTION 5.6: ROLE MANUAL (Paper Background #E6E2DD)                    */}
        {/* ========================================================================= */}
        <section
          id="roles"
          className="w-full bg-[#E6E2DD] text-[#101010] px-6 md:px-12 lg:px-20 py-20 border-t border-[#A39B8F]/30"
        >
          <div className="w-full max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="w-full pb-8 border-b border-[#A39B8F]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <span className="font-label-code text-label-code text-[#101010] bg-[#FCBC18] px-2 py-0.5 font-bold uppercase tracking-widest border border-[#101010]">
                  03 / ROLES
                </span>
                <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[#101010] uppercase font-bold tracking-tight">
                  Role Manual &amp; Authority Matrix
                </h2>
              </div>
              <span className="font-label-code text-label-code text-[#8C8B91] uppercase">
                SECURITY ACCESS SPEC: RBAC-LEVEL-04
              </span>
            </div>

            {/* Permission Matrix Table */}
            <div className="mt-12 bg-[#F2ECE6] border border-[#A39B8F]/40 overflow-x-auto relative">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                    <th className="p-4 border-r border-[#A39B8F]/30 w-2/5">FIELD ACTION / PRIVILEGE</th>
                    <th className="p-4 border-r border-[#A39B8F]/30 w-1/5 text-center">SITE SUPERVISOR</th>
                    <th className="p-4 border-r border-[#A39B8F]/30 w-1/5 text-center">STORE IN-CHARGE</th>
                    <th className="p-4 w-1/5 text-center">PROJECT AUDITOR</th>
                  </tr>
                </thead>
                <tbody className="font-label-code text-label-code divide-y divide-[#A39B8F]/30 text-[#101010]">
                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Upload stage photos</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Upload delivery challans</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Log material issued</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Review flags</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#FCBC18] text-[#101010] font-bold">VIEW</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Approve milestone</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#E6E2DD]/40 transition-colors">
                    <td className="p-4 font-bold border-r border-[#A39B8F]/30 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#101010]" />
                      <span>Change thresholds</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 border-r border-[#A39B8F]/30 text-center">
                      <span className="inline-block px-3 py-1 bg-[#E6E2DD] text-[#8C8B91]">NO</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-[#2F6F4E] text-[#F2ECE6] font-bold">YES</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Role Summaries (3 Column Bento Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {/* Site Supervisor */}
              <div className="p-6 bg-[#F2ECE6] border border-[#A39B8F]/40 flex flex-col justify-between hover:border-[#101010] transition-colors">
                <div>
                  <div className="font-label-meta text-label-meta uppercase tracking-widest text-[#8C8B91] mb-2">
                    OPERATIONAL TIER 01
                  </div>
                  <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mb-3">
                    Site Supervisor
                  </h3>
                  <p className="font-body-md text-body-md text-[#5F5E5E] leading-relaxed">
                    Captures ground truth at the exact point of execution. Bound by strictly live geolocation and chronological constraints.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#A39B8F]/20 flex items-center justify-between font-label-code text-label-code">
                  <span className="text-[#101010]">CLEARANCE: FIELD DATA ONLY</span>
                  <Link
                    to="/login"
                    className="text-primary font-bold hover:underline"
                  >
                    LOGIN →
                  </Link>
                </div>
              </div>

              {/* Store In-Charge */}
              <div className="p-6 bg-[#F2ECE6] border border-[#A39B8F]/40 flex flex-col justify-between hover:border-[#101010] transition-colors">
                <div>
                  <div className="font-label-meta text-label-meta uppercase tracking-widest text-[#8C8B91] mb-2">
                    OPERATIONAL TIER 02
                  </div>
                  <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mb-3">
                    Store In-Charge
                  </h3>
                  <p className="font-body-md text-body-md text-[#5F5E5E] leading-relaxed">
                    Registers material receipt and reconciles against dispatches. Eliminates inventory ghosting at site perimeters.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#A39B8F]/20 flex items-center justify-between font-label-code text-label-code">
                  <span className="text-[#101010]">CLEARANCE: LOGISTICS LEDGER</span>
                  <Link
                    to="/login"
                    className="text-primary font-bold hover:underline"
                  >
                    LOGIN →
                  </Link>
                </div>
              </div>

              {/* Project Auditor */}
              <div className="p-6 bg-[#F2ECE6] border border-[#A39B8F]/40 flex flex-col justify-between border-t-4 border-t-[#FCBC18] hover:border-[#101010] transition-colors">
                <div>
                  <div className="font-label-meta text-label-meta uppercase tracking-widest text-[#8C8B91] mb-2">
                    GOVERNANCE TIER 03
                  </div>
                  <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mb-3">
                    Project Auditor
                  </h3>
                  <p className="font-body-md text-body-md text-[#5F5E5E] leading-relaxed">
                    Holds final clearance authority with immutable evidentiary backing. The single signatory gatekeeper for financial milestones.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#A39B8F]/20 flex items-center justify-between font-label-code text-label-code">
                  <span className="text-[#2F6F4E] font-bold">CLEARANCE: APEX CRYPTO SEAL</span>
                  <Link
                    to="/login"
                    className="text-primary font-bold hover:underline"
                  >
                    LOGIN →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. SECTION 5.7: CLOSING CALL TO ACTION (Dark Ink Section #101010)         */}
        {/* ========================================================================= */}
        <section
          id="spec-2025"
          className="w-full bg-[#101010] text-[#F2ECE6] px-6 md:px-12 lg:px-20 py-28 border-t border-[#A39B8F]/20 relative overflow-hidden"
        >
          {/* Architectural Construction Crosshair Datum Pattern in Background */}
          <div className="pointer-events-none absolute inset-0 opacity-10 flex items-center justify-center">
            <div className="w-200 h-200 border border-[#A39B8F] flex items-center justify-center">
              <div className="w-125 h-125 border border-[#FCBC18] flex items-center justify-center">
                <div className="w-50 h-50 border border-[#A39B8F]" />
              </div>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center">
            <div className="inline-flex items-center space-x-2 border border-[#FCBC18] px-3 py-1 mb-8 bg-[#101010]">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#FCBC18]">
                MANDATE 2025 // SITE CERTAINTY
              </span>
            </div>

            <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg uppercase font-bold text-[#F2ECE6] tracking-tight leading-none mb-6">
              Make every claim prove itself.
            </h2>

            <p className="font-body-lg text-body-lg text-[#A39B8F] max-w-2xl leading-relaxed mb-10">
              Eliminate progress fiction, delivery leakage, and phantom material draws. Deploy CONSTRA across your active civil assets today.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link
                to="/login"
                className="w-full sm:w-auto bg-[#FCBC18] text-[#101010] font-label-code text-label-code uppercase tracking-wider px-8 py-4 font-bold border border-[#101010] hover:bg-[#F2ECE6] transition-all shadow-[4px_4px_0px_#101010]"
              >
                Open the portal
              </Link>
              <button
                onClick={() => scrollToSection("protocol")}
                className="w-full sm:w-auto bg-transparent text-[#F2ECE6] font-label-code text-label-code uppercase tracking-wider px-8 py-4 font-bold border border-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors cursor-pointer"
                type="button"
              >
                See how it works
              </button>
            </div>

            {/* One-line project note */}
            <div className="mt-16 pt-8 border-t border-[#A39B8F]/20 w-full flex flex-col md:flex-row items-center justify-between gap-4 font-label-meta text-label-meta text-[#8C8B91] uppercase tracking-wider">
              <span>CONSTRA SPECIFICATION &amp; AUDIT STANDARD // 2025</span>
              <span className="text-[#FCBC18]">BUILT FOR SITE CERTAINTY</span>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 8. ARCHITECTURAL FOOTER                                                   */}
      {/* ========================================================================= */}
      <footer className="relative z-10 w-full bg-[#101010] text-[#F2ECE6] border-t border-[#101010]">
        <div className="w-full px-6 md:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="font-label-code text-label-code text-[#FCBC18] uppercase tracking-[0.14em]">
              CONSTRA AUDIT REGISTRY
            </span>
            <span className="text-[#A39B8F] text-body-sm">//</span>
            <span className="font-label-meta text-label-meta text-[#A39B8F] uppercase tracking-[0.12em]">
              CIVIL STANDARD ASTM-E2018
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <span className="font-label-meta text-label-meta text-[#A39B8F] uppercase">
              DOC REF: CS-8820-AUDIT
            </span>
            <span className="font-label-meta text-label-meta text-[#A39B8F] uppercase">
              COORDINATE: 40.7128° N, 74.0060° W
            </span>
            <span className="font-label-code text-label-code text-[#F2ECE6]">
              © 2025 CONSTRA ENGINEERING CORP.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
