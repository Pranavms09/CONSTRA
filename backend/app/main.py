import logging
from typing import Any, cast
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
from app.routers import auth, users, pings, store, analysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("siteverify")


def bootstrap_admin():
    db = SessionLocal()
    try:
        # Pre-seed demo users for instant zero-friction testing of all three roles
        demo_seeds = [
            ("supervisor@siteverify.com", "Alice Supervisor", "supervisor"),
            ("store@siteverify.com", "Bob Storekeeper", "store_incharge"),
            ("auditor@siteverify.com", "Carol Auditor", "auditor"),
        ]
        for email, name, role in demo_seeds:
            existing = db.query(User).filter(func.lower(User.email) == email.lower()).first()
            if not existing:
                db.add(User(
                    email=email.lower(),
                    full_name=name,
                    role=role,
                    is_active=True,
                    firebase_uid=f"uid_{role}",
                    auth_provider="demo"
                ))
        db.commit()

        if settings.BOOTSTRAP_ADMIN_EMAIL:
            admin_email = settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip()
            existing_user = db.query(User).filter(func.lower(User.email) == admin_email).first()
            if not existing_user:
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
    except Exception as exc:
        logger.error(f"Error during admin bootstrap: {exc}")
        db.rollback()
    finally:
        db.close()


import os
from fastapi.staticfiles import StaticFiles

def ensure_db_columns():
    """Idempotently ensure newly added columns exist in SQLite database."""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(image_analyses)"))
            existing_cols = {row[1] for row in result.fetchall()}
            needed = [
                ("project_id", "INTEGER"),
                ("stage_id", "INTEGER"),
                ("gps_status", "VARCHAR(50)"),
                ("gps_latitude", "FLOAT"),
                ("gps_longitude", "FLOAT"),
                ("gps_distance_m", "FLOAT"),
                ("verification_result", "TEXT"),
                ("alert_id", "INTEGER"),
            ]
            for col_name, col_type in needed:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE image_analyses ADD COLUMN {col_name} {col_type}"))
            conn.commit()
    except Exception as exc:
        logger.warning(f"Schema column check note: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized
    Base.metadata.create_all(bind=engine)
    ensure_db_columns()
    bootstrap_admin()
    try:
        from scripts.seed_store_demo import seed_store_demo
        seed_store_demo()
    except Exception as exc:
        logger.warning(f"Demo store seeding note: {exc}")
    yield



app = FastAPI(
    title="SiteVerify API",
    description="Multi-Stage Construction Milestone Verifier API",
    version="1.0.0",
    lifespan=lifespan
)

# Ensure upload directory exists and mount for cross-laptop static access
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# SlowAPI rate limiting configuration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))

# CORS Middleware: allow configured origin and all local dev origins including preflight OPTIONS
allowed_origins = [
    settings.FRONTEND_ORIGIN,
    "https://constra.pranavms09.workers.dev",
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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.pages\.dev|.*\.workers\.dev)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
from app.api.analysis import router as analysis_router
from app.api.claims import router as claims_router

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pings.router)
app.include_router(store.router)
app.include_router(analysis_router)
app.include_router(claims_router)
app.include_router(analysis.router)
