import asyncio
import hashlib
import json
import time

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.checks.exif_gps_analyzer import analyze_exif_gps

router = APIRouter(prefix="/api/v1", tags=["Claims Audit Desk"])

# In-memory store for claims, jobs, extractions, decisions, and reports
CLAIMS_DB: Dict[str, Dict[str, Any]] = {
    "CLM-2026-001": {
        "id": "CLM-2026-001",
        "claimant": "Apex Infrastructure Ltd",
        "policy_no": "POL-INSP-88492",
        "project_id": "project-001",
        "type": "Column Casting Milestone Verification",
        "filed_at": "2026-10-09T08:30:00Z",
        "risk": "HIGH",
        "status": "IN_REVIEW",
        "files": [
            {"id": "f1", "name": "column_casting_invoice.pdf", "kind": "doc", "size": "1.2 MB"},
            {"id": "f2", "name": "column_casting.jpg", "kind": "photo", "size": "3.4 MB"},
        ],
        "ai": {
            "claimant": {
                "fieldKey": "claimant",
                "value": "Apex Infrastructure Ltd",
                "confidence": 0.99,
                "source": "OCR p.1",
                "source_ref": "column_casting_invoice.pdf"
            },
            "policy_no": {
                "fieldKey": "policy_no",
                "value": "POL-INSP-88492",
                "confidence": 0.97,
                "source": "OCR p.1",
                "source_ref": "column_casting_invoice.pdf"
            },
            "inspection_date": {
                "fieldKey": "inspection_date",
                "value": "2026-10-08",
                "confidence": 0.94,
                "source": "EXIF Metadata",
                "source_ref": "column_casting.jpg"
            },
            "stated_total": {
                "fieldKey": "stated_total",
                "value": 52322.0,
                "confidence": 0.96,
                "source": "OCR p.3",
                "source_ref": "column_casting_invoice.pdf"
            },
            "auditor_payable": {
                "fieldKey": "auditor_payable",
                "value": 50622.0,
                "confidence": 0.92,
                "source": "Calc Model",
                "source_ref": "invoice line items math check"
            },
            "gps_distance_m": {
                "fieldKey": "gps_distance_m",
                "value": 1770.0,
                "confidence": 0.98,
                "source": "GPS Geofence",
                "source_ref": "column_casting.jpg"
            },
            "damage_severity": {
                "fieldKey": "damage_severity",
                "value": "MINOR_HONEYCOMBING",
                "confidence": 0.88,
                "source": "VLM Photo Analysis",
                "source_ref": "column_casting.jpg"
            }
        },
        "decisions": {
            "claimant": {"dec": "agree", "val": "Apex Infrastructure Ltd", "note": "", "stale": False},
            "policy_no": {"dec": "agree", "val": "POL-INSP-88492", "note": "", "stale": False},
            "stated_total": {"dec": "amend", "val": 50622.0, "note": "Invoice line items sum to 50,622; 1,700 unvouched gap excluded", "stale": False},
            "gps_distance_m": {"dec": "flag", "val": 1770.0, "note": "Photo captured 1.77 km outside 200m site perimeter boundary", "stale": False},
        },
        "line_items": [
            {"desc": "M30 Grade Concrete Pouring", "qty": 45.0, "rate": 850.0, "amount": 38250.0},
            {"desc": "Rebar Shuttering & Scaffolding", "qty": 1.0, "rate": 12372.0, "amount": 12372.0},
        ],
        "report": None
    },
    "CLM-2026-002": {
        "id": "CLM-2026-002",
        "claimant": "BuildCon Heights Pvt Ltd",
        "policy_no": "POL-INSP-99104",
        "project_id": "project-001",
        "type": "Foundation Rebar Milestone",
        "filed_at": "2026-10-08T14:15:00Z",
        "risk": "MEDIUM",
        "status": "IN_REVIEW",
        "files": [
            {"id": "f3", "name": "rebar_invoice.pdf", "kind": "doc", "size": "2.1 MB"},
            {"id": "f4", "name": "foundation_rebar.jpg", "kind": "photo", "size": "4.1 MB"},
        ],
        "ai": {
            "claimant": {"fieldKey": "claimant", "value": "BuildCon Heights Pvt Ltd", "confidence": 0.98, "source": "OCR p.1", "source_ref": "rebar_invoice.pdf"},
            "stated_total": {"fieldKey": "stated_total", "value": 145000.0, "confidence": 0.95, "source": "OCR p.2", "source_ref": "rebar_invoice.pdf"},
            "gps_distance_m": {"fieldKey": "gps_distance_m", "value": 45.0, "confidence": 0.99, "source": "GPS Geofence", "source_ref": "foundation_rebar.jpg"},
        },
        "decisions": {},
        "line_items": [
            {"desc": "Fe550 TMT Steel Bars (12mm)", "qty": 2.5, "rate": 58000.0, "amount": 145000.0},
        ],
        "report": None
    },
    "CLM-2026-003": {
        "id": "CLM-2026-003",
        "claimant": "Skyline Developers",
        "policy_no": "POL-INSP-44310",
        "project_id": "project-001",
        "type": "Roof Slab Concrete Pouring",
        "filed_at": "2026-10-07T11:00:00Z",
        "risk": "LOW",
        "status": "APPROVED",
        "files": [
            {"id": "f5", "name": "roof_slab_bill.pdf", "kind": "doc", "size": "1.8 MB"},
            {"id": "f6", "name": "roof_slab.jpg", "kind": "photo", "size": "5.0 MB"},
        ],
        "ai": {
            "claimant": {"fieldKey": "claimant", "value": "Skyline Developers", "confidence": 0.99, "source": "OCR p.1", "source_ref": "roof_slab_bill.pdf"},
            "stated_total": {"fieldKey": "stated_total", "value": 320000.0, "confidence": 0.98, "source": "OCR p.1", "source_ref": "roof_slab_bill.pdf"},
            "gps_distance_m": {"fieldKey": "gps_distance_m", "value": 12.0, "confidence": 0.99, "source": "GPS Geofence", "source_ref": "roof_slab.jpg"},
        },
        "decisions": {
            "claimant": {"dec": "agree", "val": "Skyline Developers", "note": "", "stale": False},
            "stated_total": {"dec": "agree", "val": 320000.0, "note": "", "stale": False},
            "gps_distance_m": {"dec": "agree", "val": 12.0, "note": "", "stale": False},
        },
        "line_items": [
            {"desc": "RMC Ready Mix Concrete M35", "qty": 80.0, "rate": 4000.0, "amount": 320000.0},
        ],
        "report": {
            "verdict": "agree",
            "verdictNote": "All milestone evidence and EXIF geofencing parameters fully verified.",
            "sha256": "8f3b49c0d12e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
            "submitted_at": "2026-10-07T14:30:00Z"
        }
    }
}

JOBS_DB: Dict[str, Dict[str, Any]] = {}


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
            "claimant": c["claimant"],
            "policy_no": c["policy_no"],
            "type": c["type"],
            "filed_at": c["filed_at"],
            "risk": c["risk"],
            "status": c["status"],
            "file_count": len(c["files"]),
            "has_report": c["report"] is not None
        }
        for c in CLAIMS_DB.values()
    ]


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str):
    """Fetch complete claim details including AI extractions, auditor decisions, and report."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Run real EXIF analysis on uploaded photo if available
    photo_file = next((f["name"] for f in claim["files"] if f["kind"] == "photo"), "column_casting.jpg")
    photo_path = Path("uploads") / photo_file
    if not photo_path.is_file():
        photo_path = Path("backend") / "uploads" / photo_file

    exif_report = None
    if photo_path.is_file():
        try:
            exif_report = analyze_exif_gps(
                photo_path,
                site_latitude=12.9716,
                site_longitude=77.5946,
            )
        except Exception:
            exif_report = None

    return {
        **claim,
        "exif_report": exif_report
    }


def process_agent_command(job_id: str, claim_id: str, command: str, params: Optional[Dict[str, Any]]):
    """Background task simulating model service extraction jobs (OCR, VLM, EXIF)."""
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
            time.sleep(1.5)
            new_extractions["stated_total"] = {
                "fieldKey": "stated_total",
                "value": 52322.0,
                "confidence": 0.97,
                "source": "OCR v2.4 (Document p.1-3)",
                "source_ref": "column_casting_invoice.pdf"
            }
            new_extractions["auditor_payable"] = {
                "fieldKey": "auditor_payable",
                "value": 50622.0,
                "confidence": 0.95,
                "source": "Line Item Auditor Math",
                "source_ref": "Math reconciliation check"
            }

        if command in ["run_vlm", "run_all"]:
            JOBS_DB[job_id]["step"] = "Running Vision-Language Model on site photos..."
            time.sleep(1.5)
            new_extractions["damage_severity"] = {
                "fieldKey": "damage_severity",
                "value": "STRUCTURAL_HONEYCOMBING_CONFIRMED",
                "confidence": 0.91,
                "source": "VLM v3.0 (Site Photo Analysis)",
                "source_ref": "column_casting.jpg"
            }

        if command in ["run_exif", "run_all"]:
            JOBS_DB[job_id]["step"] = "Analyzing EXIF metadata & GPS geofence..."
            time.sleep(1.0)
            photo_file = next((f["name"] for f in claim["files"] if f["kind"] == "photo"), "column_casting.jpg")
            photo_path = Path("uploads") / photo_file
            if not photo_path.is_file():
                photo_path = Path("backend") / "uploads" / photo_file

            if photo_path.is_file():
                report = analyze_exif_gps(photo_path, site_latitude=12.9716, site_longitude=77.5946)
                gps_check = next((c for c in report["checks"] if c["name"] == "gps_geofence"), None)
                dist = gps_check["details"].get("distance_from_site_m", 1770.0) if gps_check and "details" in gps_check else 1770.0
            else:
                dist = 1770.0

            new_extractions["gps_distance_m"] = {
                "fieldKey": "gps_distance_m",
                "value": dist,
                "confidence": 0.99,
                "source": "EXIF GPS Geofence Check",
                "source_ref": photo_file
            }

        if command == "rerun_field" and params and "fieldKey" in params:
            fkey = params["fieldKey"]
            JOBS_DB[job_id]["step"] = f"Re-running model extraction for {fkey}..."
            time.sleep(1.0)
            if fkey == "stated_total":
                new_extractions[fkey] = {
                    "fieldKey": fkey,
                    "value": 52322.0,
                    "confidence": 0.98,
                    "source": "Re-run OCR Engine v2.4",
                    "source_ref": "page 3"
                }

        # Apply extractions and detect stale auditor decisions
        for key, r in new_extractions.items():
            prev = claim["ai"].get(key)
            claim["ai"][key] = r
            d = claim["decisions"].get(key)
            if d and d.get("dec") and prev and prev.get("value") != r.get("value"):
                d["stale"] = True

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
    return {"status": "ok", "decisions": claim["decisions"]}


@router.post("/claims/{claim_id}/submit")
def submit_report(claim_id: str, payload: SubmitReportPayload):
    """Submit final auditor report with SHA-256 integrity hash."""
    claim = CLAIMS_DB.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Validate verdict rules
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

    if payload.verdict in ["amend", "disagree", "flag"] and len((payload.verdictNote or "").strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Auditor summary note of at least 10 characters is required for this verdict."
        )

    # Construct report payload & calculate SHA-256 hash
    report_data = {
        "claim_id": claim_id,
        "verdict": payload.verdict,
        "verdict_note": payload.verdictNote,
        "decisions": payload.decisions,
        "ai_snapshot": claim["ai"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "revision": (claim["report"]["revision"] + 1) if claim.get("report") else 1
    }

    raw_bytes = json.dumps(report_data, sort_keys=True).encode("utf-8")
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

    report_record = {
        **report_data,
        "sha256": sha256_hash
    }

    claim["report"] = report_record
    claim["status"] = "APPROVED" if payload.verdict in ["agree", "amend"] else "FLAGGED"

    return {
        "status": "success",
        "message": f"Audit report submitted with SHA-256 hash {sha256_hash[:12]}...",
        "report": report_record
    }
