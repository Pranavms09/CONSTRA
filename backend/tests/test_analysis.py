import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image

from app.database import Base, get_db
from app.models.user import User
from app.models.image_analysis import ImageAnalysis
from app.models.audit_log import AuditLog
from app.main import app

# Setup isolated in-memory SQLite database for analysis testing
ANALYSIS_DATABASE_URL = "sqlite:///:memory:"

analysis_engine = create_engine(
    ANALYSIS_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=analysis_engine)
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_analysis_database():
    Base.metadata.create_all(bind=analysis_engine)
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=analysis_engine)
    app.dependency_overrides.pop(get_db, None)


def create_test_image(format="JPEG", color="blue", size=(100, 100)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


# --- Tests ---

def test_api_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "SiteVerify API"
    assert "gemini_configured" in data
    # Ensure api key is NOT exposed anywhere in the response
    assert "api_key" not in data
    assert "key" not in data


def test_analyze_image_missing_file():
    res = client.post("/api/analyze-image")
    assert res.status_code == 400
    assert "No image file provided" in res.json()["detail"]


def test_analyze_image_invalid_corrupted_file():
    fake_file = io.BytesIO(b"this is not an image at all")
    res = client.post(
        "/api/analyze-image",
        files={"file": ("fake.jpg", fake_file, "image/jpeg")}
    )
    assert res.status_code == 400
    assert "not a valid or readable image" in res.json()["detail"]


def test_analyze_image_unsupported_mime():
    text_file = io.BytesIO(b"hello world")
    res = client.post(
        "/api/analyze-image",
        files={"file": ("notes.txt", text_file, "text/plain")}
    )
    assert res.status_code == 400


@patch("app.services.gemini_service.get_gemini_api_key")
def test_analyze_image_missing_api_key(mock_get_key):
    mock_get_key.return_value = None

    img_bytes = create_test_image()
    res = client.post(
        "/api/analyze-image",
        files={"file": ("site.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )
    assert res.status_code == 500
    assert "Gemini API key is not configured" in res.json()["detail"]


@patch("app.services.gemini_service.get_gemini_api_key")
@patch("app.services.gemini_service.genai.Client")
def test_analyze_image_success(mock_client_class, mock_get_key):
    mock_get_key.return_value = "test_gemini_api_key_123"

    mock_client_instance = MagicMock()
    mock_client_class.return_value = mock_client_instance

    mock_response = MagicMock()
    mock_response.text = (
        "Foundation excavation phase: Rebar reinforcement cages are placed and tied. "
        "Formwork shuttering panels are aligned along the southern perimeter. Concrete pouring ready."
    )
    mock_client_instance.models.generate_content.return_value = mock_response

    img_bytes = create_test_image()
    res = client.post(
        "/api/analyze-image",
        files={"file": ("foundation_step2.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "Foundation excavation phase" in data["description"]
    assert data["filename"] == "foundation_step2.jpg"
    assert data["source"] == "backend_gemini_vision"
    assert data["model"] == "gemini-2.5-flash"

    # Verify saved in database
    db = TestingSessionLocal()
    record = db.query(ImageAnalysis).filter_by(filename="foundation_step2.jpg").first()
    assert record is not None
    assert "Foundation excavation phase" in record.description
    assert record.source == "backend_gemini_vision"

    # Verify audit log recorded
    audit = db.query(AuditLog).filter_by(action="image_analysis").first()
    assert audit is not None
    db.close()


@patch("app.services.gemini_service.get_gemini_api_key")
@patch("app.services.gemini_service.genai.Client")
def test_analyze_image_gemini_failure_no_fabrication(mock_client_class, mock_get_key):
    mock_get_key.return_value = "test_gemini_api_key_123"

    mock_client_instance = MagicMock()
    mock_client_class.return_value = mock_client_instance
    mock_client_instance.models.generate_content.side_effect = RuntimeError("Upstream network timeout")

    img_bytes = create_test_image()
    res = client.post(
        "/api/analyze-image",
        files={"file": ("site.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )

    assert res.status_code == 500
    data = res.json()
    assert "Upstream network timeout" in data["detail"] or "Image analysis failed" in data["detail"]
    # Verify no fabricated description returned
    assert "description" not in data


def test_immutable_ai_description():
    # Attempting to edit or overwrite an analysis via PUT/PATCH is forbidden
    put_res = client.put("/api/analyze-image/1", json={"description": "Hacked description"})
    assert put_res.status_code == 403
    assert "strictly immutable" in put_res.json()["detail"]

    patch_res = client.patch("/api/analyze-image/1", json={"description": "Hacked description"})
    assert patch_res.status_code == 403
    assert "strictly immutable" in patch_res.json()["detail"]


@patch("app.services.gemini_service.get_gemini_api_key")
@patch("app.services.gemini_service.genai.Client")
def test_list_analyses(mock_client_class, mock_get_key):
    mock_get_key.return_value = "test_key"
    mock_response = MagicMock()
    mock_response.text = "Test inspection note"
    mock_client_class.return_value.models.generate_content.return_value = mock_response

    # Upload one image
    img_bytes = create_test_image()
    client.post(
        "/api/analyze-image",
        files={"file": ("test_site.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )

    res = client.get("/api/analyses")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    assert items[0]["filename"] == "test_site.jpg"
