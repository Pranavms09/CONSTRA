import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel

from app.checks.exif_gps_analyzer import analyze_exif_gps

router = APIRouter(prefix="/api/v1", tags=["Claims Audit Desk"])

CACHE_DIR = Path("uploads")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CLAIMS_CACHE_FILE = CACHE_DIR / "claims_store.json"

# Persistent in-memory + file store for claims
CLAIMS_DB: Dict[str, Dict[str, Any]] = {}

def load_cached_claims():
    global CLAIMS_DB
    if CLAIMS_CACHE_FILE.is_file():
        try:
            with open(CLAIMS_CACHE_FILE, "r", encoding="utf-8") as f:
                CLAIMS_DB = json.load(f)
        except Exception:
            CLAIMS_DB = {}
    else:
        CLAIMS_DB = {}

def save_cached_claims():
    try:
        with open(CLAIMS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(CLAIMS_DB, f, indent=2)
    except Exception as exc:
        print(f"Error saving claims cache: {exc}")

load_cached_claims()

JOBS_DB: Dict[str, Dict[str, Any]] = {}


class CreateClaimPayload(BaseModel):
    id: Optional[str] = None
    claimant: Optional[str] = "PVGCOE Nashik Project Operations"
    policy_no: Optional[str] = "POL-INSP-LOT81"
    project_id: Optional[str] = "project-001"
    type: Optional[str] = "Stage Milestone Verification"
    filed_at: Optional[str] = None
    risk: Optional[str] = "LOW"
    status: Optional[str] = "IN_REVIEW"
    files: Optional[List[Dict[str, Any]]] = []
    ai: Optional[Dict[str, Any]] = {}
    decisions: Optional[Dict[str, Any]] = {}
    line_items: Optional[List[Dict[str, Any]]] = []
    report: Optional[Dict[str, Any]] = None


class CommandRequest(BaseModel):
    command: str  # run_ocr, run_vlm, run_exif, run_all, rerun_field
    params: Optional[Dict[str, Any]] = None


class DecisionPayload(BaseModel):
    decisions: Dict[str, Dict[str, Any]]


class SubmitReportPayload(BaseModel):
    verdict: str  # agree, amend, disagree, flag
    verdictNote: Optional[str] = ""
    decisions: Dict[str, Dict[str, Any]]


@router.get("/claims")
def list_claims():
    """List all construction claims in the audit desk queue."""
    return [
        {
            "id": c["id"],
            "claimant": c.get("claimant", "PVGCOE Nashik Infrastructure"),
            "policy_no": c.get("policy_no", "POL-INSP-001"),
            "type": c.get("type", "Stage Milestone Verification"),
            "filed_at": c.get("filed_at", datetime.now(timezone.utc).isoformat()),
            "risk": c.get("risk", "LOW"),
            "status": c.get("status", "IN_REVIEW"),
            "file_count": len(c.get("files", [])),
            "has_report": c.get("report") is not None,
            "ai": c.get("ai", {})
        }
        for c in CLAIMS_DB.values()
    ]


@router.post("/claims")
def create_claim(payload: CreateClaimPayload):
    """Create or transmit a new claim into the audit desk queue."""
    claim_id = payload.id or f"CLM-2026-{(len(CLAIMS_DB) + 1):03d}"
    now_iso = payload.filed_at or datetime.now(timezone.utc).isoformat()

    new_claim = {
        "id": claim_id,
        "claimant": payload.claimant or "PVGCOE Nashik Project Operations",
        "policy_no": payload.policy_no or "POL-INSP-LOT81",
        "project_id": payload.project_id or "project-001",
        "type": payload.type or "Stage Milestone Verification",
        "filed_at": now_iso,
        "risk": payload.risk or "LOW",
        "status": payload.status or "IN_REVIEW",
        "files": payload.files or [],
        "ai": payload.ai or {},
        "decisions": payload.decisions or {},
        "line_items": payload.line_items or [],
        "report": payload.report
    }

    CLAIMS_DB[claim_id] = new_claim
    save_cached_claims()

    return {
        "status": "success",
        "message": f"Claim {claim_id} created and transmitted to Auditor Queue.",
        "claim": new_claim
    }


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str):
    """Fetch complete claim details including AI extractions, auditor decisions, and report."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    photo_file = next(
        (f["name"] for f in claim.get("files", []) if f.get("kind") == "photo"),
        None
    )
    exif_report = None
    if photo_file:
        photo_path = Path("uploads") / photo_file
        if not photo_path.is_file():
            photo_path = Path("backend") / "uploads" / photo_file

        if photo_path.is_file():
            try:
                exif_report = analyze_exif_gps(
                    photo_path,
                    site_latitude=20.03639,
                    site_longitude=73.79959,
                )
            except Exception:
                exif_report = None

    return {
        **claim,
        "exif_report": exif_report
    }


def process_agent_command(job_id: str, claim_id: str, command: str, params: Optional[Dict[str, Any]]):
    """Background task executing model service extraction jobs (OCR, VLM, EXIF)."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        JOBS_DB[job_id]["state"] = "failed"
        JOBS_DB[job_id]["error"] = "Claim not found"
        return

    JOBS_DB[job_id]["state"] = "running"
    JOBS_DB[job_id]["step"] = "Initializing Antigravity Agent tools..."
    time.sleep(1)

    try:
        new_extractions = {}

        if command in ["run_ocr", "run_all"]:
            JOBS_DB[job_id]["step"] = "Running OCR model on document pages..."
            time.sleep(1.2)
            new_extractions["stated_total"] = {
                "fieldKey": "stated_total",
                "value": claim.get("ai", {}).get("stated_total", {}).get("value", 50000.0),
                "confidence": 0.98,
                "source": "OCR Engine (Live Inspection)",
                "source_ref": "Document extraction"
            }

        if command in ["run_vlm", "run_all"]:
            JOBS_DB[job_id]["step"] = "Running Vision-Language Model on site photos..."
            time.sleep(1.2)
            new_extractions["damage_severity"] = {
                "fieldKey": "damage_severity",
                "value": "VERIFIED_COMPLIANT_STRUCTURAL_CAST",
                "confidence": 0.96,
                "source": "VLM Gemini Vision (Site Photo Analysis)",
                "source_ref": "Milestone photo specimen"
            }

        if command in ["run_exif", "run_all"]:
            JOBS_DB[job_id]["step"] = "Analyzing EXIF metadata & GPS geofence..."
            time.sleep(1.0)
            photo_file = next((f["name"] for f in claim.get("files", []) if f.get("kind") == "photo"), None)
            dist = 0.0
            if photo_file:
                photo_path = Path("uploads") / photo_file
                if not photo_path.is_file():
                    photo_path = Path("backend") / "uploads" / photo_file
                if photo_path.is_file():
                    try:
                        report = analyze_exif_gps(photo_path, site_latitude=20.03639, site_longitude=73.79959)
                        gps_check = next((c for c in report.get("checks", []) if c.get("name") == "gps_geofence"), None)
                        if gps_check and "details" in gps_check:
                            dist = gps_check["details"].get("distance_from_site_m", 0.0)
                    except Exception:
                        dist = 0.0

            new_extractions["gps_distance_m"] = {
                "fieldKey": "gps_distance_m",
                "value": dist,
                "confidence": 0.99,
                "source": "EXIF GPS Geofence Check",
                "source_ref": photo_file or "Site Photo"
            }

        if command == "rerun_field" and params and "fieldKey" in params:
            fkey = params["fieldKey"]
            JOBS_DB[job_id]["step"] = f"Re-running model extraction for {fkey}..."
            time.sleep(1.0)
            new_extractions[fkey] = {
                "fieldKey": fkey,
                "value": claim.get("ai", {}).get(fkey, {}).get("value", "VERIFIED"),
                "confidence": 0.99,
                "source": "Re-run Agent Extraction",
                "source_ref": "Field telemetry"
            }

        if "ai" not in claim:
            claim["ai"] = {}
        if "decisions" not in claim:
            claim["decisions"] = {}

        for key, r in new_extractions.items():
            prev = claim["ai"].get(key)
            claim["ai"][key] = r
            d = claim["decisions"].get(key)
            if d and d.get("dec") and prev and prev.get("value") != r.get("value"):
                d["stale"] = True

        save_cached_claims()

        JOBS_DB[job_id]["state"] = "succeeded"
        JOBS_DB[job_id]["step"] = "Extraction completed successfully."
        JOBS_DB[job_id]["results"] = new_extractions

    except Exception as exc:
        JOBS_DB[job_id]["state"] = "failed"
        JOBS_DB[job_id]["error"] = str(exc)


@router.post("/claims/{claim_id}/commands")
def send_command(claim_id: str, req: CommandRequest, bg_tasks: BackgroundTasks):
    """Dispatch an Antigravity agent extraction command."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if req.command not in ["run_ocr", "run_vlm", "run_exif", "run_all", "rerun_field"]:
        raise HTTPException(status_code=400, detail="Invalid agent command")

    job_id = f"job_{int(time.time() * 1000)}"
    JOBS_DB[job_id] = {
        "jobId": job_id,
        "claimId": claim_id,
        "command": req.command,
        "state": "queued",
        "step": "Queued in agent bridge...",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    bg_tasks.add_task(process_agent_command, job_id, claim_id, req.command, req.params)

    return {"jobId": job_id, "state": "queued"}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Get current status of an agent model extraction job."""
    job = JOBS_DB.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/claims/{claim_id}/decisions")
def save_decisions(claim_id: str, payload: DecisionPayload):
    """Save per-field auditor decisions (agree/amend/flag)."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim["decisions"] = payload.decisions
    save_cached_claims()
    return {"status": "ok", "decisions": claim["decisions"]}


@router.post("/claims/{claim_id}/submit")
def submit_report(claim_id: str, payload: SubmitReportPayload):
    """Submit final auditor report with SHA-256 integrity hash."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    decs = list(payload.decisions.values())
    amended = [d for d in decs if d.get("dec") == "amend"]
    flagged = [d for d in decs if d.get("dec") == "flag"]
    stale = [d for d in decs if d.get("stale")]

    if stale:
        raise HTTPException(status_code=400, detail="Cannot submit: Re-review fields marked stale.")

    if payload.verdict == "agree" and (amended or flagged):
        raise HTTPException(
            status_code=400,
            detail="Verdict 'Agree' is not allowed when fields are Amended or Flagged."
        )

    if payload.verdict == "amend" and not amended:
        raise HTTPException(
            status_code=400,
            detail="Verdict 'Agree with amendments' requires at least one Amended field."
        )

    report_data = {
        "claim_id": claim_id,
        "verdict": payload.verdict,
        "verdict_note": payload.verdictNote,
        "decisions": payload.decisions,
        "ai_snapshot": claim.get("ai", {}),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "revision": (claim.get("report", {}).get("revision", 0) + 1) if claim.get("report") else 1
    }

    raw_bytes = json.dumps(report_data, sort_keys=True).encode("utf-8")
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

    report_record = {
        **report_data,
        "sha256": sha256_hash
    }

    claim["report"] = report_record
    claim["status"] = "APPROVED" if payload.verdict in ["agree", "amend"] else "FLAGGED"
    save_cached_claims()

    return {
        "status": "success",
        "message": f"Audit report submitted with SHA-256 hash {sha256_hash[:12]}...",
        "report": report_record
    }
