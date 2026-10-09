import math
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.material import Material, BoqItem
from app.models.project import Stage, ProjectSettings
from app.models.challan import MaterialIssue


class AnomalyResult(BaseModel):
    is_anomalous: bool
    level: str  # ok, warn, alert
    reasons: List[str]
    numbers: Dict[str, Any]


def calculate_zscore(daily_totals: List[float], today_val: float) -> tuple[float, float, float]:
    """Calculates z-score against historical daily totals."""
    n = len(daily_totals)
    if n < 5:
        return 0.0, 0.0, 0.0

    mean = sum(daily_totals) / n
    variance = sum((x - mean) ** 2 for x in daily_totals) / (n - 1)
    std = math.sqrt(variance)

    if std == 0:
        return 0.0, mean, 0.0

    z = (today_val - mean) / std
    return z, mean, std


def assess_issue(
    db: Session,
    stage: Stage,
    material: Material,
    new_qty_base: Decimal,
    settings: ProjectSettings = None
) -> AnomalyResult:
    """
    Assesses a proposed material issue using Method A (verified progress expected usage)
    and Method B (historical rolling drawdown z-score analysis).
    """
    dec_new_qty = Decimal(str(new_qty_base))
    tolerance = Decimal(str(settings.expected_usage_tolerance if settings else 0.15))
    z_limit = float(settings.zscore_limit if settings else 2.5)

    reasons: List[str] = []
    level = "ok"

    # 1. Planned BOQ for this stage and material
    boq = (
        db.query(BoqItem)
        .filter(
            BoqItem.stage_id == stage.id,
            BoqItem.material_id == material.id
        )
        .first()
    )
    planned_qty_base = Decimal(str(boq.planned_qty_base)) if boq else Decimal("0.0")

    # 2. Cumulative already issued to this stage
    already_issued = (
        db.query(func.coalesce(func.sum(MaterialIssue.qty_base), 0))
        .filter(
            MaterialIssue.stage_id == stage.id,
            MaterialIssue.material_id == material.id
        )
        .scalar()
    )
    dec_already_issued = Decimal(str(already_issued or 0))
    cumulative_total = dec_already_issued + dec_new_qty

    # --- Method A: Progress-Tied Ratio ---
    progress = Decimal(str(stage.verified_progress or 0))
    expected_for_progress = planned_qty_base * progress

    if progress == Decimal("0.0"):
        reasons.append("No verified work yet for this stage")
        level = "warn"
    elif expected_for_progress > 0:
        max_allowed = expected_for_progress * (Decimal("1.0") + tolerance)
        if cumulative_total > max_allowed:
            excess_ratio = (cumulative_total - expected_for_progress) / expected_for_progress
            reasons.append("Issued more than expected for verified work")

            if excess_ratio > (tolerance * Decimal("2.0")):
                level = "alert"
            else:
                level = "warn"

    # --- Method B: Historical Daily Z-Score (last 14 days) ---
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
    # Group issues by date
    daily_rows = (
        db.query(
            func.date(MaterialIssue.issued_at).label("day"),
            func.sum(MaterialIssue.qty_base).label("day_total")
        )
        .join(Stage, MaterialIssue.stage_id == Stage.id)
        .filter(
            Stage.project_id == stage.project_id,
            MaterialIssue.material_id == material.id,
            MaterialIssue.issued_at >= fourteen_days_ago
        )
        .group_by(func.date(MaterialIssue.issued_at))
        .all()
    )

    daily_totals = [float(r.day_total) for r in daily_rows]
    z_score, hist_mean, hist_std = calculate_zscore(daily_totals, float(dec_new_qty))

    if len(daily_totals) >= 5 and abs(z_score) > z_limit:
        reasons.append(f"Statistically abnormal issue spike (z-score: {z_score:.2f} > limit: {z_limit})")
        level = "alert"

    is_anomalous = level in ["warn", "alert"]

    numbers = {
        "planned_qty_base": float(planned_qty_base),
        "verified_progress": float(progress),
        "expected_for_progress": float(expected_for_progress),
        "already_issued": float(dec_already_issued),
        "new_qty_base": float(dec_new_qty),
        "cumulative_total": float(cumulative_total),
        "expected_usage_tolerance": float(tolerance),
        "z_score": round(z_score, 2),
        "z_score_limit": z_limit,
    }

    return AnomalyResult(
        is_anomalous=is_anomalous,
        level=level,
        reasons=reasons,
        numbers=numbers
    )


def preview_issue(
    db: Session,
    stage_id: int,
    material_id: int,
    new_qty_base: Decimal
) -> AnomalyResult:
    """Pure preview evaluation without modifying database state."""
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    material = db.query(Material).filter(Material.id == material_id).first()
    settings = None
    if stage:
        settings = db.query(ProjectSettings).filter(ProjectSettings.project_id == stage.project_id).first()

    return assess_issue(db, stage, material, new_qty_base, settings)
