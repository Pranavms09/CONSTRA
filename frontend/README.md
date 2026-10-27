# 🏗️ CONSTRA Frontend — Construction Milestone & Anti-Fraud Portal

> **Industrial-grade, role-based web application for automated construction site verification, VLM stage audits, delivery challan OCR reconciliation, material consumption monitoring, and cryptographic milestone certificate gating.**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](#)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](#)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.3-38B2AC?logo=tailwindcss&logoColor=white)](#)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-v5-FF4154?logo=reactquery&logoColor=white)](#)
[![GSAP](https://img.shields.io/badge/Motion-GSAP%20%2B%20Lenis-88CE02?logo=greensock&logoColor=white)](#)
[![Firebase](https://img.shields.io/badge/Auth-Firebase%20%2B%20JWT-FFCA28?logo=firebase&logoColor=black)](#)
[![Linter](https://img.shields.io/badge/Linter-Oxlint-blue)](#)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features & Role Portals](#-key-features--role-portals)
  - [1. Public Landing & Showcase](#1-public-landing--showcase)
  - [2. Site Supervisor Portal (`/supervisor`)](#2-site-supervisor-portal-supervisor)
  - [3. Store In-Charge Management Suite (`/store/*`)](#3-store-in-charge-management-suite-store)
  - [4. Project Auditor Command Center (`/auditor`)](#4-project-auditor-command-center-auditor)
  - [5. Multimodal Image Analysis Playground (`/analyze`)](#5-multimodal-image-analysis-playground-analyze)
- [Design System: CONSTRA](#-design-system-constra)
- [Technology Stack](#-technology-stack)
- [Directory Structure](#-directory-structure)
- [Environment Variables](#-environment-variables)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development Server](#development-server)
  - [Production Build & Preview](#production-build--preview)
  - [Linting](#linting)
- [API Integration & Auth Architecture](#-api-integration--auth-architecture)
- [Role-Based Access Matrix](#-role-based-access-matrix)

---

## 🌟 Overview

**CONSTRA Frontend** provides an intuitive, high-precision civil engineering dashboard built to eliminate milestone fraud, ghost deliveries, and off-book material diversion.

Equipped with a custom technical drafting design system (**CONSTRA**), smooth GSAP scroll choreography, Lenis inertia scrolling, and TanStack asynchronous query caching, the frontend delivers specialized workflows for three core stakeholders:
1. **Site Supervisors** submitting geo-tagged, tamper-verified milestone progress photos from the job site.
2. **Store In-Charges** uploading vendor challan delivery slips, validating OCR extractions against the BOQ, and tracking material dispatch logs.
3. **Project Auditors** triaging anomaly alerts, verifying multi-source evidence, and approving tamper-gated milestone completion certificates.

---

## 🚀 Key Features & Role Portals

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CONSTRA PORTAL ARCHITECTURE                            │
├─────────────────────┬───────────────────────┬───────────────────┬──────────────────────┤
│ 🌐 Public Landing   │ 👷 Supervisor         │ 📦 Store In-Charge│ 🔍 Auditor Center    │
│ • Interactive VLM   │ • Geo-tagged uploads  │ • Challan OCR scan│ • Milestone triage   │
│ • Architecture tour │ • EXIF check preview  │ • BOQ line check  │ • Critical alerts    │
│ • Spec inspection   │ • Milestone feed      │ • Issue tracking  │ • Certificate issue  │
│ • Direct login auth │ • Progress status     │ • Stock ledgers   │ • Evidence audit     │
└─────────────────────┴───────────────────────┴───────────────────┴──────────────────────┘
```

### 1. Public Landing & Showcase (`/` or `/landing`)
- **Cinematic Technical Hero**: Ultra-wide technical typography with GSAP scroll triggers and smooth Lenis scrolling.
- **Interactive VLM Audit Simulator**: Live interactive demonstration showing bounding box detection, stage verification confidence, and tamper checks.
- **Pipeline Breakdown**: Visual breakdown of EXIF forensics, unit normalization, and statistical consumption models ($z$-score).
- **Direct Role Launchers**: Quick authentication and direct portal navigation.

### 2. Site Supervisor Portal (`/supervisor`)
- **Mobile-Optimized Field Uploads**: Direct camera capture or file ingestion with instant client-side SHA-256 hash generation and EXIF extraction.
- **Milestone Progress Feed**: Stage-by-stage status check (Pending, In Progress, Under Review, Verified, Cleared).
- **Tamper Warnings**: Real-time feedback if location coordinates deviate from geofenced site boundaries or timestamp mismatches occur.

### 3. Store In-Charge Management Suite (`/store/*`)
- **Dashboard (`/store`)**: Live telemetry of total inventory, low-stock warnings, and unreviewed delivery challans.
- **Challan Delivery Ingestion (`/store/deliveries/new`)**: Upload vendor physical delivery slips with automatic OCR processing.
- **Challan Review (`/store/deliveries/:id`)**: Split-screen manual verification UI allowing operators to correct extracted quantities against BOQ allocations before acceptance.
- **Material Issue Engine (`/store/issue` & `/store/issues`)**: Log cement, steel, and aggregate dispatches tied to specific milestones and contractors.
- **Stock Summary & Anomaly Alerts (`/store/stock` & `/store/alerts`)**: Current physical balance, consumption velocity, and statistical anomaly flags.

### 4. Project Auditor Command Center (`/auditor`)
- **Comprehensive Milestone Audit**: Multi-source evidence comparison (VLM photo audits vs. Challan OCR vs. Issue logs vs. BOQ specs).
- **Alert Triage Workflow**: Resolve or investigate critical/warning anomalies (e.g., photo taken 5km off-site, excessive cement consumption).
- **Cryptographic Certificate Gating**: Download tamper-evident milestone clearance certificates. Issuance is strictly disabled while open critical alerts remain.

### 5. Multimodal Image Analysis Playground (`/analyze`)
- Standalone testing bench for uploading site photos or challans directly into the backend AI pipeline to inspect raw VLM predictions, bounding coordinates, and confidence scores.

---

## 📐 Design System: CONSTRA

The frontend adheres to **CONSTRA — Technical Blueprint & Civil Site Specification System**:

- **Color Palette**:
  - `Primary Accent (#FCBC18)`: High-visibility Signal Yellow for action buttons, callout indicators, and active tabs.
  - `Base Surfaces (#E6E2DD / #F2ECE6)`: Warm bond ivory and drafting paper tones preventing field glare.
  - `Dark Inks (#101010)`: Carbon black for sharp structural contrast and technical title blocks.
  - `Technical Hairlines (#A39B8F / #C3C6C9)`: Calibrated rule lines and blueprint datum rails.
  - `Status (#2F6F4E / #B3261E)`: Field-grade OK Green and Danger Red.
- **Typography**:
  - Primary UI & Numbers: `Quantico` and `Roboto Condensed` via `@fontsource`.
  - Micro-labels: Uppercase tracking (`letter-spacing: 0.12em`) with tabular numbers (`tabular-nums`).
- **Geometry**:
  - **Strict Zero Border Radius (`rounded-none`)**: Sharp industrial edges on all cards, inputs, buttons, and modals.
  - **Hard Offset Panels**: Solid 2px–3px black offset shadow (`box-shadow: 3px 3px 0px #101010`) without diffuse blur.

---

## 🛠️ Technology Stack

| Layer | Library / Tool | Purpose |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) | Component architecture & modern hooks |
| **Build Tool** | [Vite 8](https://vite.dev/) | Lightning-fast HMR and optimized bundler |
| **Routing** | [React Router v7](https://reactrouter.com/) | Declarative nested routing & RBAC route protection |
| **Styling** | [TailwindCSS v4](https://tailwindcss.com/) + CSS Variables | High-performance atomic styles & drafting system tokens |
| **Animations** | [GSAP 3](https://greensock.com/gsap/) + [Lenis](https://lenis.darkroom.engineering/) | Smooth scroll orchestration & scroll triggers |
| **Data Fetching** | [TanStack React Query v5](https://tanstack.com/query) | Async state, query caching, optimistic UI updates |
| **Authentication** | [Firebase Auth](https://firebase.google.com/docs/auth) | Client auth state & secure JWT token generation |
| **Typography** | `@fontsource/quantico`, `@fontsource/roboto-condensed` | Industrial engineering typography |
| **Linter** | [Oxlint](https://oxc.rs/) | Blazing fast Rust-based linting engine |

---

## 📁 Directory Structure

```text
frontend/
├── public/                  # Static assets & icons
├── src/
│   ├── api/                 # HTTP client & REST endpoints
│   │   ├── client.js        # Axios/Fetch wrapper with JWT auth interceptors
│   │   └── store.js         # Store deliveries, issues, and inventory endpoints
│   ├── assets/              # SVG diagrams, badges, and illustrations
│   ├── auth/                # Authentication & Access Control
│   │   ├── AuthContext.jsx  # React context providing user, token & role state
│   │   ├── ProtectedRoute.jsx # RBAC route guard enforcing allowed roles
│   │   └── firebase.js      # Firebase SDK initialization
│   ├── components/          # Reusable UI components
│   │   ├── ImageAnalysisSection.jsx # Multimodal OCR & VLM visualizer
│   │   └── store/           # Store-specific widgets (StatCard, AlertBanner, etc.)
│   ├── design/              # Design tokens and theme configuration
│   ├── pages/               # Application route views
│   │   ├── auditor/         # Auditor Command Center
│   │   │   └── AuditorHome.jsx
│   │   ├── store/           # Store In-Charge Suite
│   │   │   ├── StoreLayout.jsx
│   │   │   ├── StoreDashboard.jsx
│   │   │   ├── DeliveriesList.jsx
│   │   │   ├── NewDelivery.jsx
│   │   │   ├── ChallanReview.jsx
│   │   │   ├── IssueMaterial.jsx
│   │   │   ├── IssueHistory.jsx
│   │   │   ├── StockSummary.jsx
│   │   │   └── StoreAlerts.jsx
│   │   ├── supervisor/      # Site Supervisor Mobile Portal
│   │   │   └── SupervisorHome.jsx
│   │   ├── ImageAnalysisPage.jsx # AI verification playground
│   │   ├── LandingPage.jsx  # GSAP-powered public landing
│   │   ├── LoginPage.jsx    # Role-based credential authentication
│   │   └── NotFound.jsx     # Technical 404 error page
│   ├── App.css              # Global custom utility classes
│   ├── App.jsx              # Main routing tree & AuthProvider root
│   ├── index.css            # Tailwind directives & CSS drafting variables
│   └── main.jsx             # React DOM root entry point
├── .env.example             # Template environment variables
├── package.json             # NPM dependencies & scripts
├── vite.config.js           # Vite build & plugin configurations
└── DESIGN.md                # CONSTRA technical drafting spec
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `frontend` root by copying `.env.example`:

```bash
cp .env.example .env
```

Populate the configuration parameters:

```ini
# Backend API Gateway Base URL
VITE_API_BASE_URL=http://localhost:8000

# Firebase Authentication Credentials
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_firebase_app_id_here
```

---

## 🚦 Getting Started & Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm` (v9+) or `yarn` / `pnpm`
- **Backend Service**: Running FastAPI backend at `http://localhost:8000` (see `../backend/`)

### Installation
Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

### Development Server
Launch the Vite local development server with Hot Module Replacement:

```bash
npm run dev
```

The application will be accessible at:
👉 **`http://localhost:5173`**

### Production Build & Preview
To build optimized static production assets:

```bash
npm run build
```

To locally preview the generated production bundle:

```bash
npm run preview
```

### Linting
Run the Oxlint suite for code hygiene and hook checks:

```bash
npm run lint
```

---

## 🔐 API Integration & Auth Architecture

1. **Authentication Flow**:
   - User signs in via `/login` with credentials.
   - `firebase.js` / `AuthContext.jsx` authenticates the user and fetches an active JWT ID token.
   - The token and user role (`supervisor`, `store_incharge`, `auditor`) are saved in the global React context.
2. **Request Interceptor**:
   - `src/api/client.js` attaches `Authorization: Bearer <token>` to all outbound API requests destined for `VITE_API_BASE_URL`.
   - Automatically handles 401 Unauthorized errors by directing users to the login route.

---

## 🛡️ Role-Based Access Matrix

| Route Path | Allowed Roles | Description |
| :--- | :--- | :--- |
| `/` or `/landing` | Public | System marketing showcase & interactive AI simulator |
| `/login` | Public | Credential authentication & automatic role redirect |
| `/analyze` | Public / All | Standalone VLM & OCR diagnostic tool |
| `/supervisor` | `supervisor` | Field milestone photo submission & EXIF audit |
| `/store/*` | `store_incharge` | Challan OCR, BOQ reconciliation, stock & issue logs |
| `/auditor` | `auditor` | Multi-source evidence review & certificate gating |

---

## 👥 Contributors & License

Built with ❤️ for **Hack-A-Night**. All civil verification specs, VLM prompt chains, and certificate gating rules conform to the project technical requirements.
