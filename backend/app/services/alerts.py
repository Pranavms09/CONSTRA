import json
from app.models.alert import Alert


def raise_alert(db, *, project_id, stage_id=None, type, severity, explanation,
                evidence: dict, challan_id=None, issue_id=None, photo_id=None):
    """Create one alert. If an OPEN alert with the same (stage_id, type, challan_id,
    issue_id) exists, update its evidence/explanation instead of creating a duplicate.
    Returns the alert."""
    evidence_str = json.dumps(evidence) if isinstance(evidence, dict) else str(evidence)

    query = db.query(Alert).filter(
        Alert.project_id == project_id,
        Alert.type == type,
        Alert.status == "open",
        Alert.stage_id == stage_id,
        Alert.challan_id == challan_id,
        Alert.issue_id == issue_id,
    )

    existing = query.first()
    if existing:
        existing.severity = severity
        existing.explanation = explanation
        existing.evidence = evidence_str
        db.commit()
        db.refresh(existing)
        return existing

    new_alert = Alert(
        project_id=project_id,
        stage_id=stage_id,
        challan_id=challan_id,
        issue_id=issue_id,
        photo_id=photo_id,
        type=type,
        severity=severity,
        status="open",
        explanation=explanation,
        evidence=evidence_str,
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert
