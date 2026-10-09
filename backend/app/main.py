import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import func

from app.config import settings
from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.limiter import limiter
from app.routers import auth, users, pings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("siteverify")


def bootstrap_admin():
    if not settings.BOOTSTRAP_ADMIN_EMAIL:
        return

    admin_email = settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip()
    db = SessionLocal()
    try:
        # Check if an auditor already exists
        auditor_exists = db.query(User).filter(User.role == "auditor").first()
        if not auditor_exists:
            # Check if this user email exists
            existing_user = db.query(User).filter(func.lower(User.email) == admin_email).first()
            if existing_user:
                existing_user.role = "auditor"
                existing_user.is_active = True
                db.commit()
                logger.info(f"Promoted existing user {admin_email} to bootstrap auditor.")
            else:
                new_auditor = User(
                    email=admin_email,
                    full_name="Bootstrap Auditor",
                    role="auditor",
                    is_active=True,
                    firebase_uid=None,
                    auth_provider="google"
                )
                db.add(new_auditor)
                db.commit()
                logger.info(f"Created bootstrap auditor with email: {admin_email}")
        else:
            logger.info("Auditor already present in database; skipping bootstrap.")
    except Exception as exc:
        logger.error(f"Error during admin bootstrap: {exc}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized
    Base.metadata.create_all(bind=engine)
    bootstrap_admin()
    yield


app = FastAPI(
    title="SiteVerify API",
    description="Multi-Stage Construction Milestone Verifier API",
    version="1.0.0",
    lifespan=lifespan
)

# SlowAPI rate limiting configuration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware: allow configured origin and all local dev origins including preflight OPTIONS
allowed_origins = [
    settings.FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pings.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "SiteVerify API"}
