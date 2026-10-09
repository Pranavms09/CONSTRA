import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.main import app

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Pre-seed users
    supervisor = User(
        email="supervisor@siteverify.com",
        full_name="Alice Supervisor",
        role="supervisor",
        is_active=True,
        firebase_uid=None,
        auth_provider="google"
    )
    store = User(
        email="store@siteverify.com",
        full_name="Bob Storekeeper",
        role="store_incharge",
        is_active=True,
        firebase_uid="store_existing_uid",
        auth_provider="google"
    )
    auditor = User(
        email="auditor@siteverify.com",
        full_name="Carol Auditor",
        role="auditor",
        is_active=True,
        firebase_uid=None,
        auth_provider="google"
    )
    inactive_user = User(
        email="inactive@siteverify.com",
        full_name="Dave Inactive",
        role="supervisor",
        is_active=False,
        firebase_uid=None,
        auth_provider="google"
    )
    db.add_all([supervisor, store, auditor, inactive_user])
    db.commit()
    app.dependency_overrides[get_db] = override_get_db
    yield

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


# --- Tests ---

def test_missing_or_invalid_token():
    # No header
    res = client.post("/auth/login", json={"claimed_role": "supervisor"})
    assert res.status_code == 422 or res.status_code == 401

    # Bad header format
    res = client.post(
        "/auth/login",
        headers={"Authorization": "NotBearer 123"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 401
    assert "Invalid or expired login" in res.json()["detail"]


@patch("app.routers.auth.verify_firebase_token")
def test_valid_token_role_matches(mock_verify):
    mock_verify.return_value = {
        "uid": "new_uid_alice",
        "email": "supervisor@siteverify.com",
        "email_verified": True
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_alice"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "supervisor@siteverify.com"
    assert data["role"] == "supervisor"
    assert data["full_name"] == "Alice Supervisor"

    # Verify UID was bound in database and last_login_at set
    db = TestingSessionLocal()
    user = db.query(User).filter_by(email="supervisor@siteverify.com").first()
    assert user.firebase_uid == "new_uid_alice"
    assert user.last_login_at is not None

    # Verify audit log entry
    audit = db.query(AuditLog).filter_by(actor_id=user.id, action="login").first()
    assert audit is not None
    db.close()


@patch("app.routers.auth.verify_firebase_token")
def test_valid_token_role_mismatch(mock_verify):
    mock_verify.return_value = {
        "uid": "new_uid_alice",
        "email": "supervisor@siteverify.com",
        "email_verified": True
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_alice"},
        json={"claimed_role": "auditor"}
    )
    assert res.status_code == 403
    assert "not registered as auditor" in res.json()["detail"]

    # Verify audit log recorded denied login
    db = TestingSessionLocal()
    audit = db.query(AuditLog).filter_by(action="login_denied").order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert "Role mismatch" in audit.detail
    db.close()


@patch("app.routers.auth.verify_firebase_token")
def test_unregistered_email(mock_verify):
    mock_verify.return_value = {
        "uid": "unknown_uid",
        "email": "stranger@gmail.com",
        "email_verified": True
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_stranger"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 403
    assert "Your account is not registered. Contact your Auditor." in res.json()["detail"]


@patch("app.routers.auth.verify_firebase_token")
def test_inactive_user(mock_verify):
    mock_verify.return_value = {
        "uid": "inactive_uid",
        "email": "inactive@siteverify.com",
        "email_verified": True
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_inactive"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 403
    assert "Your account is not registered or is disabled." in res.json()["detail"]


@patch("app.routers.auth.verify_firebase_token")
def test_unverified_email(mock_verify):
    mock_verify.return_value = {
        "uid": "unverified_uid",
        "email": "supervisor@siteverify.com",
        "email_verified": False
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_unverified"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 403
    assert "Email is not verified" in res.json()["detail"]


@patch("app.routers.auth.verify_firebase_token")
def test_case_insensitive_email(mock_verify):
    mock_verify.return_value = {
        "uid": "new_uid_alice",
        "email": "SUPERVISOR@SiteVerify.COM",
        "email_verified": True
    }

    res = client.post(
        "/auth/login",
        headers={"Authorization": "Bearer mock_token_alice_caps"},
        json={"claimed_role": "supervisor"}
    )
    assert res.status_code == 200
    assert res.json()["email"] == "supervisor@siteverify.com"


@patch("app.auth.deps.verify_firebase_token")
def test_ping_endpoints_role_segregation(mock_verify):
    # Mock token as Supervisor
    mock_verify.return_value = {
        "uid": "uid_alice",
        "email": "supervisor@siteverify.com",
        "email_verified": True
    }

    # Supervisor calling supervisor ping -> 200
    res = client.get("/supervisor/ping", headers={"Authorization": "Bearer mock_supervisor"})
    assert res.status_code == 200
    assert res.json()["role"] == "supervisor"

    # Supervisor calling auditor ping -> 403
    res_auditor = client.get("/auditor/ping", headers={"Authorization": "Bearer mock_supervisor"})
    assert res_auditor.status_code == 403

    # Supervisor calling store ping -> 403
    res_store = client.get("/store/ping", headers={"Authorization": "Bearer mock_supervisor"})
    assert res_store.status_code == 403


@patch("app.auth.deps.verify_firebase_token")
def test_auditor_users_management(mock_verify):
    # Mock token as Auditor
    mock_verify.return_value = {
        "uid": "uid_carol",
        "email": "auditor@siteverify.com",
        "email_verified": True
    }

    # Auditor listing users -> 200
    res = client.get("/users", headers={"Authorization": "Bearer mock_auditor"})
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 3

    # Auditor adding a user -> 201
    new_user_payload = {
        "full_name": "New Supervisor",
        "email": "new_super@siteverify.com",
        "role": "supervisor"
    }
    create_res = client.post("/users", headers={"Authorization": "Bearer mock_auditor"}, json=new_user_payload)
    assert create_res.status_code == 201
    assert create_res.json()["email"] == "new_super@siteverify.com"

    # Now mock token as Supervisor trying to add a user -> 403
    mock_verify.return_value = {
        "uid": "uid_alice",
        "email": "supervisor@siteverify.com",
        "email_verified": True
    }
    fail_res = client.post("/users", headers={"Authorization": "Bearer mock_supervisor"}, json=new_user_payload)
    assert fail_res.status_code == 403


@patch("app.auth.deps.verify_firebase_token")
def test_get_me_restores_session(mock_verify):
    mock_verify.return_value = {
        "uid": "store_existing_uid",
        "email": "store@siteverify.com",
        "email_verified": True
    }

    res = client.get("/auth/me", headers={"Authorization": "Bearer mock_store"})
    assert res.status_code == 200
    assert res.json()["email"] == "store@siteverify.com"
    assert res.json()["role"] == "store_incharge"
