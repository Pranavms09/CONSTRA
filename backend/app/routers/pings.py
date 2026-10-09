from fastapi import APIRouter, Depends
from app.auth.deps import require_role
from app.models.user import User

router = APIRouter(tags=["ping"])


@router.get("/supervisor/ping")
def supervisor_ping(user: User = Depends(require_role("supervisor"))):
    return {
        "status": "ok",
        "message": "Welcome, Site Supervisor. Access granted.",
        "role": user.role,
        "user": user.email
    }


@router.get("/store/ping")
def store_ping(user: User = Depends(require_role("store_incharge"))):
    return {
        "status": "ok",
        "message": "Welcome, Store In-Charge. Access granted.",
        "role": user.role,
        "user": user.email
    }


@router.get("/auditor/ping")
def auditor_ping(user: User = Depends(require_role("auditor"))):
    return {
        "status": "ok",
        "message": "Welcome, Project Auditor. Access granted.",
        "role": user.role,
        "user": user.email
    }
