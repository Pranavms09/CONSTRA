import os
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_exif_gps_analysis_endpoint():
    # Ensure test file exists in uploads
    os.makedirs("uploads", exist_ok=True)
    file_path = Path("uploads/column_casting.jpg")
    if not file_path.exists():
        from PIL import Image
        img = Image.new("RGB", (50, 50), color="red")
        img.save(file_path)

    response = client.get("/api/v1/projects/project-001/evidence/column_casting.jpg/exif-gps")
    assert response.status_code == 200
    data = response.json()
    assert data["report_type"] == "EXIF_GPS_ANALYSIS"
    assert data["file_name"] == "column_casting.jpg"
    assert "overall_status" in data
    assert "checks" in data
    assert len(data["checks"]) > 0

def test_invalid_project():
    response = client.get("/api/v1/projects/non-existent/evidence/column_casting.jpg/exif-gps")
    assert response.status_code == 404

def test_invalid_filename_traversal():
    response = client.get("/api/v1/projects/project-001/evidence/..%2Fsecret.jpg/exif-gps")
    assert response.status_code in [400, 404]
