import io
import json
from unittest.mock import MagicMock, patch
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.construction_vision import (
    ConstructionVisionAnalysis,
    StageAssessment,
    analyze_construction_evidence,
    GeminiVisionError,
    run_evidence_ai_analysis_async,
)
from app.services.firestore_db import set_firestore_client
from tests.chain.mock_firestore import MockFirestoreClient


@pytest.fixture(autouse=True)
def setup_mock_firestore():
    mock_client = MockFirestoreClient()
    set_firestore_client(mock_client)
    yield mock_client
    set_firestore_client(None)


def create_test_image_bytes():
    img = Image.new("RGB", (200, 200), color=(252, 188, 24))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_construction_vision_analysis_schema_valid():
    sample_data = {
        "summary": "Vertical reinforcement bars assembled for concrete column",
        "work_category": "Reinforced Concrete",
        "observed_activities": [
            "Tying vertical reinforcement steel",
            "Formwork placement preparation"
        ],
        "materials_visible": [
            "Deformed steel rebar",
            "Tie wire",
            "Timber formwork panels"
        ],
        "equipment_visible": [
            "Rebar bender",
            "Scaffolding"
        ],
        "stage_assessment": {
            "observed_stage": "Column Reinforcement & Shuttering",
            "confidence": "high",
            "reasoning": "Clear vertical rebar cages and timber formwork visible on site"
        },
        "progress_indicators": [
            "Rebar cages tied up to 3 meters height"
        ],
        "quality_observations": [
            "Rebar spacing appears consistent",
            "No visible rust on steel"
        ],
        "potential_issues": [],
        "limitations": [
            "Concrete pouring has not occurred yet; strength cannot be determined"
        ],
        "report": "Site photograph confirms active reinforcement steel placement for vertical columns. Formwork panels are staged nearby."
    }

    model = ConstructionVisionAnalysis.model_validate(sample_data)
    assert model.summary.startswith("Vertical reinforcement")
    assert model.work_category == "Reinforced Concrete"
    assert len(model.observed_activities) == 2
    assert model.stage_assessment.confidence == "high"
    assert len(model.limitations) == 1


def test_analyze_construction_evidence_mock_success():
    img_bytes = create_test_image_bytes()

    mock_resp_json = json.dumps({
        "summary": "Excavation and foundation trenching in progress",
        "work_category": "Earthwork & Excavation",
        "observed_activities": ["Trench excavation for strip footing"],
        "materials_visible": ["Soil", "Gravel bedding"],
        "equipment_visible": ["Hydraulic excavator"],
        "stage_assessment": {
            "observed_stage": "Foundation Trenching",
            "confidence": "high",
            "reasoning": "Open excavation trench with visible excavator bucket"
        },
        "progress_indicators": ["Trench excavated along grid lines"],
        "quality_observations": ["Trench edges appear stable"],
        "potential_issues": [],
        "limitations": ["Depth cannot be confirmed without survey rod"],
        "report": "Trench excavation is underway for the building foundation."
    })

    mock_response = MagicMock()
    mock_response.text = mock_resp_json

    with patch("app.services.construction_vision.get_gemini_api_key", return_value="AIzaSyTestMockKey"), \
         patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.models.generate_content.return_value = mock_response

        analysis = analyze_construction_evidence(
            file_bytes=img_bytes,
            mime_type="image/jpeg",
            stage_name="Footing Excavation",
            project_name="Bridge Pier Project"
        )

        assert isinstance(analysis, ConstructionVisionAnalysis)
        assert analysis.work_category == "Earthwork & Excavation"
        assert "Trench excavation for strip footing" in analysis.observed_activities
        assert analysis.stage_assessment.observed_stage == "Foundation Trenching"


def test_analyze_construction_evidence_missing_key_raises_error():
    img_bytes = create_test_image_bytes()
    with patch("app.services.construction_vision.get_gemini_api_key", return_value=None):
        with pytest.raises(GeminiVisionError) as exc_info:
            analyze_construction_evidence(img_bytes, "image/jpeg")
        assert exc_info.value.code == "API_KEY_MISSING"


def test_analyze_construction_evidence_corrupt_image_raises_error():
    with patch("app.services.construction_vision.get_gemini_api_key", return_value="AIzaSyTestMockKey"):
        with pytest.raises(GeminiVisionError) as exc_info:
            analyze_construction_evidence(b"not an image", "image/jpeg")
        assert exc_info.value.code == "INVALID_IMAGE"


def test_run_evidence_ai_analysis_async(setup_mock_firestore):
    client = setup_mock_firestore
    img_bytes = create_test_image_bytes()

    mock_analysis = ConstructionVisionAnalysis(
        summary="Formwork installation for slab",
        work_category="Formwork & Shuttering",
        observed_activities=["Setting up timber shuttering"],
        materials_visible=["Plywood", "Props"],
        equipment_visible=[],
        stage_assessment=StageAssessment(observed_stage="Slab Formwork", confidence="medium", reasoning="Plywood deck"),
        progress_indicators=["Half deck completed"],
        quality_observations=[],
        potential_issues=[],
        limitations=["Rebar not yet placed"],
        report="Formwork installation for first floor slab is active."
    )

    with patch("app.services.construction_vision.analyze_construction_evidence", return_value=mock_analysis):
        import asyncio
        asyncio.run(run_evidence_ai_analysis_async(
            evidence_id=999,
            file_bytes=img_bytes,
            mime_type="image/jpeg",
            stage_name="Slab Prep",
            project_name="Commercial Complex"
        ))

    # Verify Firestore document
    doc = client.collection("evidence_analysis").document("999").get()
    assert doc.exists
    doc_data = doc.to_dict()
    assert doc_data["ai_analysis_status"] == "completed"
    assert doc_data["ai_summary"] == "Formwork installation for slab"
    assert doc_data["ai_model"] == settings.GEMINI_MODEL
    assert doc_data["ai_structured_result"]["work_category"] == "Formwork & Shuttering"


def test_supervisor_endpoints_extended_response(setup_mock_firestore):
    test_client = TestClient(app)
    img_bytes = create_test_image_bytes()
    import hashlib
    sha256 = hashlib.sha256(img_bytes).hexdigest()

    auth_headers = {"Authorization": "Bearer demo-supervisor"}

    mock_analysis = ConstructionVisionAnalysis(
        summary="Excavation site preparation",
        work_category="Earthwork",
        observed_activities=["Soil excavation"],
        materials_visible=["Earth"],
        equipment_visible=["Excavator"],
        stage_assessment=StageAssessment(observed_stage="Excavation", confidence="high", reasoning="Excavated pit"),
        progress_indicators=["Pit excavated"],
        quality_observations=[],
        potential_issues=[],
        limitations=[],
        report="Site excavation active."
    )

    import uuid
    unique_dev_id = f"TEST-DEV-{uuid.uuid4().hex[:12]}"

    with patch.object(settings, "CHAIN_MODE", "fake"), \
         patch("app.routers.supervisor.upload_evidence_image", return_value="https://cdn.cloudinary.com/test.jpg"), \
         patch("app.services.construction_vision.analyze_construction_evidence", return_value=mock_analysis):
        res = test_client.post(
            "/supervisor/evidence",
            data={
                "device_evidence_id": unique_dev_id,
                "project_id": 1,
                "stage_id": 1,
                "captured_at": "2026-10-10T00:00:00Z",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "accuracy_m": 5.0,
                "client_sha256": sha256,
                "notes": "Testing AI and blockchain extended fields"
            },
            files={"file": ("site.jpg", img_bytes, "image/jpeg")},
            headers=auth_headers
        )

        assert res.status_code in (200, 201)
        body = res.json()

        # Check extended fields
        assert "ai_analysis" in body
        assert body["ai_analysis"]["status"] in ("pending", "analyzing", "completed")
        assert "blockchain" in body
        assert body["blockchain"]["status"] in ("queued", "pending", "submitted", "confirmed", "simulated")
        assert body["blockchain"]["network"] == "sepolia"
        assert body["blockchain"]["chain_id"] == 11155111

        ev_id = body["id"]

        # Check GET /supervisor/evidence/{id}
        get_res = test_client.get(f"/supervisor/evidence/{ev_id}", headers=auth_headers)
        assert get_res.status_code == 200
        get_body = get_res.json()
        assert get_body["ai_analysis"]["status"] is not None
        assert get_body["blockchain"]["network"] == "sepolia"

        # Check GET /supervisor/evidence/{id}/anchor
        anchor_res = test_client.get(f"/supervisor/evidence/{ev_id}/anchor", headers=auth_headers)
        assert anchor_res.status_code == 200
        assert anchor_res.json()["network"] == "sepolia"

        # Check POST /supervisor/evidence/{id}/retry-anchor
        retry_anchor_res = test_client.post(f"/supervisor/evidence/{ev_id}/retry-anchor", headers=auth_headers)
        assert retry_anchor_res.status_code == 200
        assert retry_anchor_res.json()["blockchain"]["status"] == "queued"
