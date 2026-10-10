from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ExifTags


# EXIF tag names
TAGS = ExifTags.TAGS
GPS_TAGS = ExifTags.GPSTAGS

# Default site radius in metres
DEFAULT_SITE_RADIUS_M = 200.0

# Maximum permitted delay between capture and upload
DEFAULT_MAX_CAPTURE_AGE_HOURS = 24.0

# Authoritative Security Disclaimer
SECURITY_DISCLAIMER = (
    "Metadata-based location verification: EXIF GPS coordinates are extracted from file metadata "
    "and provide location signals, not cryptographic proof of physical presence. Metadata can be omitted, "
    "modified, or forged. Missing or unverified GPS alone does not declare fraud, and requires auditor review."
)


def sha256_file(file_path: str | Path) -> str:
    """Calculate the SHA-256 hash of an uploaded file."""
    digest = hashlib.sha256()

    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def to_decimal_degrees(value: Any) -> float:
    """Convert EXIF GPS degrees/minutes/seconds into decimal degrees."""
    if isinstance(value, (int, float)):
        return float(value)

    if not isinstance(value, (tuple, list)) or len(value) < 3:
        raise ValueError(f"GPS coordinate must contain [degrees, minutes, seconds], got {type(value)}")

    degrees, minutes, seconds = value[0], value[1], value[2]

    def number(item: Any) -> float:
        if hasattr(item, "numerator") and hasattr(item, "denominator"):
            if item.denominator == 0:
                raise ValueError("Invalid GPS coordinate rational denominator: 0")
            return float(item.numerator) / float(item.denominator)
        if hasattr(item, "num") and hasattr(item, "den"):
            if item.den == 0:
                raise ValueError("Invalid GPS coordinate rational denominator: 0")
            return float(item.num) / float(item.den)
        if isinstance(item, (tuple, list)) and len(item) == 2:
            if item[1] == 0:
                raise ValueError("Invalid GPS coordinate rational denominator: 0")
            return float(item[0]) / float(item[1])

        return float(item)

    deg = number(degrees)
    minu = number(minutes)
    sec = number(seconds)

    if deg < 0 or minu < 0 or sec < 0:
        raise ValueError("GPS degree, minute, or second components cannot be negative")

    return deg + minu / 60.0 + sec / 3600.0


def extract_gps_with_reason(exif: Any) -> tuple[dict[str, float] | None, str | None]:
    """
    Extract latitude and longitude from image EXIF metadata.
    Returns:
      ( {"latitude": float, "longitude": float}, None ) on success
      ( None, "human-readable reason" ) when missing or invalid
    """
    if exif is None:
        return None, "No EXIF metadata found in image."

    try:
        gps_ifd = {}
        if hasattr(exif, "get_ifd"):
            try:
                gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
            except Exception:
                gps_ifd = {}

        if not gps_ifd and isinstance(exif, dict):
            gps_raw = exif.get("GPSInfo") or exif.get(ExifTags.Base.GPSInfo)
            if isinstance(gps_raw, dict):
                gps_ifd = gps_raw

        if not gps_ifd:
            return None, "No EXIF GPS tags found in photo metadata."

        gps = {
            GPS_TAGS.get(tag, tag): value
            for tag, value in gps_ifd.items()
        }

        latitude = gps.get("GPSLatitude")
        longitude = gps.get("GPSLongitude")
        lat_ref = gps.get("GPSLatitudeRef")
        lon_ref = gps.get("GPSLongitudeRef")

        if latitude is None or longitude is None:
            return None, "Incomplete GPS metadata: GPSLatitude or GPSLongitude is missing."

        if lat_ref is None or lon_ref is None:
            return None, "Incomplete GPS metadata: GPSLatitudeRef or GPSLongitudeRef hemisphere tag is missing."

        lat = to_decimal_degrees(latitude)
        lon = to_decimal_degrees(longitude)

        lat_ref_str = str(lat_ref).strip().upper()
        lon_ref_str = str(lon_ref).strip().upper()

        if lat_ref_str == "S":
            lat = -lat
        elif lat_ref_str != "N":
            return None, f"Invalid GPSLatitudeRef '{lat_ref}'; must be 'N' or 'S'."

        if lon_ref_str == "W":
            lon = -lon
        elif lon_ref_str != "E":
            return None, f"Invalid GPSLongitudeRef '{lon_ref}'; must be 'E' or 'W'."

        if not (-90.0 <= lat <= 90.0):
            return None, f"GPS latitude {lat}° is outside valid geographical range (-90 to +90)."

        if not (-180.0 <= lon <= 180.0):
            return None, f"GPS longitude {lon}° is outside valid geographical range (-180 to +180)."

        return {"latitude": round(lat, 7), "longitude": round(lon, 7)}, None

    except (KeyError, TypeError, ValueError, ZeroDivisionError) as err:
        return None, f"Invalid GPS metadata: {err}"
    except Exception as exc:
        return None, f"Unexpected error reading GPS metadata: {exc}"


def extract_gps(exif: Any) -> dict[str, float] | None:
    """Extract latitude and longitude from image EXIF metadata (backwards compatible helper)."""
    coords, _ = extract_gps_with_reason(exif)
    return coords


def haversine_distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate the great-circle distance between two coordinates in metres using the Haversine formula."""
    earth_radius_m = 6_371_000.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2.0) ** 2
    )

    # Guard against floating-point rounding errors.
    a = min(1.0, max(0.0, a))

    return 2.0 * earth_radius_m * math.asin(math.sqrt(a))


def parse_capture_time(value: Any) -> datetime | None:
    """Parse common EXIF capture-time formats as naive timestamps."""
    if not value:
        return None

    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore")

    try:
        return datetime.strptime(str(value).strip(), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def utc_datetime(value: datetime) -> datetime:
    """Normalize an aware timestamp to UTC; treat naive input as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def make_check(
    name: str,
    status: str,
    message: str,
    **details: Any,
) -> dict[str, Any]:
    return {
        "name": name,
        "status": status,
        "message": message,
        "details": details,
    }


def verify_gps_geofence(
    file_path: str | Path,
    *,
    project_latitude: float,
    project_longitude: float,
    permitted_radius_m: float = DEFAULT_SITE_RADIUS_M,
) -> dict[str, Any]:
    """
    Performs authoritative GPS geofencing verification for a construction milestone photo.

    Functional Requirements:
    1. Inspect EXIF GPS metadata.
    2. Check distance against registered site coordinates using Haversine formula.
    3. Return structured verification result:
       - status / gps_status: PASS, FLAGGED, or REVIEW
       - project_coordinates: {"latitude": ..., "longitude": ...}
       - extracted_coordinates: {"latitude": ..., "longitude": ...} | None
       - distance_m: calculated distance in metres | None
       - permitted_radius_m: permitted radius in metres
       - explanation: human-readable explanation
       - alert_required: True if photo is outside permitted radius (FLAGGED)
       - security_disclaimer: metadata-based location verification statement
    """
    path = Path(file_path)
    permitted_radius_m = float(permitted_radius_m if (permitted_radius_m and permitted_radius_m > 0) else DEFAULT_SITE_RADIUS_M)
    project_coords = {
        "latitude": round(float(project_latitude), 6),
        "longitude": round(float(project_longitude), 6),
    }

    if not (-90.0 <= project_latitude <= 90.0) or not (-180.0 <= project_longitude <= 180.0):
        return {
            "status": "REVIEW",
            "gps_status": "REVIEW",
            "project_coordinates": project_coords,
            "extracted_coordinates": None,
            "distance_m": None,
            "permitted_radius_m": permitted_radius_m,
            "explanation": "Authoritative project coordinates are out of valid geographic range (-90..90, -180..180).",
            "severity": "medium",
            "alert_required": False,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }

    if not path.is_file():
        return {
            "status": "REVIEW",
            "gps_status": "REVIEW",
            "project_coordinates": project_coords,
            "extracted_coordinates": None,
            "distance_m": None,
            "permitted_radius_m": permitted_radius_m,
            "explanation": f"Photo evidence file not found on disk: {path.name}",
            "severity": "medium",
            "alert_required": False,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }

    exif = None
    try:
        with Image.open(path) as img:
            exif = img.getexif()
    except Exception as exc:
        return {
            "status": "REVIEW",
            "gps_status": "REVIEW",
            "project_coordinates": project_coords,
            "extracted_coordinates": None,
            "distance_m": None,
            "permitted_radius_m": permitted_radius_m,
            "explanation": f"Unable to read image EXIF metadata: {exc}",
            "severity": "medium",
            "alert_required": False,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }

    coords, reason = extract_gps_with_reason(exif)

    # Missing or invalid GPS metadata -> REVIEW (Requirement 6)
    if coords is None:
        return {
            "status": "REVIEW",
            "gps_status": "REVIEW",
            "project_coordinates": project_coords,
            "extracted_coordinates": None,
            "distance_m": None,
            "permitted_radius_m": permitted_radius_m,
            "explanation": reason or "EXIF GPS metadata missing or invalid; site distance cannot be automatically verified. Requires manual auditor review.",
            "severity": "medium",
            "alert_required": False,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }

    # Valid coordinates extracted -> calculate Haversine distance (Requirement 3 & 4)
    distance_m = haversine_distance_m(
        coords["latitude"],
        coords["longitude"],
        project_coords["latitude"],
        project_coords["longitude"],
    )
    dist_rounded = round(distance_m, 2)
    is_inside = distance_m <= permitted_radius_m

    if is_inside:
        explanation = (
            f"Photo GPS coordinates ({coords['latitude']}°, {coords['longitude']}°) are "
            f"{dist_rounded}m from the project centroid, within the permitted {permitted_radius_m}m radius."
        )
        return {
            "status": "PASS",
            "gps_status": "PASS",
            "project_coordinates": project_coords,
            "extracted_coordinates": coords,
            "distance_m": dist_rounded,
            "permitted_radius_m": permitted_radius_m,
            "explanation": explanation,
            "severity": "none",
            "alert_required": False,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }
    else:
        # Outside permitted radius -> FLAGGED & HIGH severity alert required (Requirement 5)
        breach_distance = round(distance_m - permitted_radius_m, 2)
        explanation = (
            f"GEOFENCE BREACH: Photo GPS coordinates ({coords['latitude']}°, {coords['longitude']}°) are "
            f"{dist_rounded}m from the project centroid, exceeding the permitted site radius of {permitted_radius_m}m by {breach_distance}m."
        )
        return {
            "status": "FLAGGED",
            "gps_status": "FLAGGED",
            "project_coordinates": project_coords,
            "extracted_coordinates": coords,
            "distance_m": dist_rounded,
            "permitted_radius_m": permitted_radius_m,
            "explanation": explanation,
            "severity": "high",
            "alert_required": True,
            "security_disclaimer": SECURITY_DISCLAIMER,
        }


def analyze_exif_gps(
    file_path: str | Path,
    *,
    site_latitude: float,
    site_longitude: float,
    uploaded_at: datetime | None = None,
    site_radius_m: float = DEFAULT_SITE_RADIUS_M,
    max_capture_age_hours: float = DEFAULT_MAX_CAPTURE_AGE_HOURS,
    known_hashes: set[str] | None = None,
) -> dict[str, Any]:
    """
    Run all EXIF, GPS, timestamp, editing-software, and hash checks.

    Status values:
      PASS            - check passed
      WARNING / REVIEW - missing or inconclusive information (requires review)
      FAIL / FLAGGED  - validation failed / geofence breached
      NOT_CHECKED     - check could not be performed
    """
    path = Path(file_path)
    uploaded_at = utc_datetime(uploaded_at or datetime.now(timezone.utc))

    checks: list[dict[str, Any]] = []

    # Validate site configuration.
    if not (-90.0 <= site_latitude <= 90.0):
        raise ValueError("site_latitude must be between -90 and 90")

    if not (-180.0 <= site_longitude <= 180.0):
        raise ValueError("site_longitude must be between -180 and 180")

    if site_radius_m <= 0 or max_capture_age_hours <= 0:
        raise ValueError("Site radius and capture age must be positive")

    # Hash the original file.
    file_hash = sha256_file(path)
    is_duplicate = file_hash in (known_hashes or set())

    checks.append(
        make_check(
            "sha256_duplicate",
            "FAIL" if is_duplicate else "PASS",
            (
                "Exact file hash already exists in the supplied hash set."
                if is_duplicate
                else "No matching hash found in the supplied hash set."
            ),
            sha256=file_hash,
        )
    )

    # Read EXIF metadata.
    exif: Any = None
    exif_data = {}

    try:
        with Image.open(path) as image_file:
            exif = image_file.getexif()
            exif_data = {
                TAGS.get(tag, tag): value
                for tag, value in exif.items()
            }
    except Exception as exc:
        exif_data = {}
        checks.append(
            make_check(
                "image_metadata",
                "NOT_CHECKED",
                "Could not read image metadata.",
                error_type=type(exc).__name__,
            )
        )

    metadata_read = exif is not None

    if metadata_read:
        checks.append(
            make_check(
                "exif_presence",
                "PASS" if exif_data else "WARNING",
                (
                    "Standard EXIF metadata is available."
                    if exif_data
                    else "No standard EXIF tags were found."
                ),
            )
        )

    # Capture time.
    capture_raw = None

    if metadata_read:
        capture_raw = (
            exif_data.get("DateTimeOriginal")
            or exif_data.get("DateTimeDigitized")
            or exif_data.get("DateTime")
        )

    capture_time = parse_capture_time(capture_raw)

    if not metadata_read:
        checks.append(
            make_check(
                "capture_time",
                "NOT_CHECKED",
                "Capture time could not be inspected because metadata was unreadable.",
            )
        )
    elif capture_time is None:
        checks.append(
            make_check(
                "capture_time",
                "WARNING",
                "A usable EXIF capture timestamp is missing.",
            )
        )
    else:
        capture_utc = capture_time.replace(tzinfo=timezone.utc)
        delay_hours = (
            uploaded_at - capture_utc
        ).total_seconds() / 3600.0

        if delay_hours < 0:
            timestamp_status = "FAIL"
            timestamp_message = "Capture timestamp is in the future."
        elif delay_hours > max_capture_age_hours:
            timestamp_status = "FAIL"
            timestamp_message = "Photo exceeds the configured capture age."
        else:
            timestamp_status = "PASS"
            timestamp_message = "Capture time is within the configured time window."

        checks.append(
            make_check(
                "capture_time",
                timestamp_status,
                timestamp_message,
                captured_at=capture_time.isoformat(),
                uploaded_at=uploaded_at.isoformat(),
                capture_to_upload_hours=round(delay_hours, 2),
                maximum_age_hours=max_capture_age_hours,
                timezone_assumption="UTC",
            )
        )

    # Run Authoritative GPS Geofencing Verification (Requirements 1, 3, 4, 6)
    gps_verification = verify_gps_geofence(
        path,
        project_latitude=site_latitude,
        project_longitude=site_longitude,
        permitted_radius_m=site_radius_m,
    )

    if not metadata_read:
        checks.append(
            make_check(
                "gps_geofence",
                "NOT_CHECKED",
                "GPS could not be inspected because metadata was unreadable.",
                gps_status="REVIEW",
            )
        )
    elif gps_verification["status"] == "PASS":
        checks.append(
            make_check(
                "gps_geofence",
                "PASS",
                gps_verification["explanation"],
                photo_latitude=gps_verification["extracted_coordinates"]["latitude"],
                photo_longitude=gps_verification["extracted_coordinates"]["longitude"],
                site_latitude=site_latitude,
                site_longitude=site_longitude,
                distance_from_site_m=gps_verification["distance_m"],
                site_radius_m=site_radius_m,
                gps_status="PASS",
            )
        )
    elif gps_verification["status"] == "FLAGGED":
        checks.append(
            make_check(
                "gps_geofence",
                "FAIL",
                gps_verification["explanation"],
                photo_latitude=gps_verification["extracted_coordinates"]["latitude"] if gps_verification["extracted_coordinates"] else None,
                photo_longitude=gps_verification["extracted_coordinates"]["longitude"] if gps_verification["extracted_coordinates"] else None,
                site_latitude=site_latitude,
                site_longitude=site_longitude,
                distance_from_site_m=gps_verification["distance_m"],
                site_radius_m=site_radius_m,
                gps_status="FLAGGED",
                alert_required=True,
            )
        )
    else:  # REVIEW
        checks.append(
            make_check(
                "gps_geofence",
                "WARNING",
                gps_verification["explanation"],
                gps_status="REVIEW",
                site_latitude=site_latitude,
                site_longitude=site_longitude,
                site_radius_m=site_radius_m,
            )
        )

    # Editing-software metadata.
    software = (
        exif_data.get("Software")
        or exif_data.get("ProcessingSoftware")
    ) if metadata_read else None

    if isinstance(software, bytes):
        software = software.decode("utf-8", errors="replace")

    if not metadata_read:
        checks.append(
            make_check(
                "editing_software",
                "NOT_CHECKED",
                "Editing-software metadata could not be inspected.",
            )
        )
    elif software:
        checks.append(
            make_check(
                "editing_software",
                "WARNING",
                "Software metadata is present; review it as a possible editing signal.",
                software=str(software),
            )
        )
    else:
        checks.append(
            make_check(
                "editing_software",
                "PASS",
                "No editing-software tag was found.",
            )
        )

    # Summarize the report without equating metadata warnings with fraud.
    fail_count = sum(c["status"] == "FAIL" for c in checks)
    warning_count = sum(c["status"] == "WARNING" for c in checks)
    unchecked_count = sum(c["status"] == "NOT_CHECKED" for c in checks)

    if fail_count:
        overall_status = "FLAGGED"
    elif warning_count or unchecked_count:
        overall_status = "REVIEW_REQUIRED"
    else:
        overall_status = "PASS"

    return {
        "report_type": "EXIF_GPS_ANALYSIS",
        "file_name": path.name,
        "file_sha256": file_hash,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall_status": overall_status,
        "summary": {
            "total_checks": len(checks),
            "passed": sum(c["status"] == "PASS" for c in checks),
            "failed": fail_count,
            "warnings": warning_count,
            "not_checked": unchecked_count,
        },
        "checks": checks,
        "gps_verification": gps_verification,
        "disclaimer": SECURITY_DISCLAIMER,
    }
