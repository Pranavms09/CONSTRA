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
DEFAULT_SITE_RADIUS_M = 200

# Maximum permitted delay between capture and upload
DEFAULT_MAX_CAPTURE_AGE_HOURS = 24


def sha256_file(file_path: str | Path) -> str:
    """Calculate the SHA-256 hash of an uploaded file."""
    digest = hashlib.sha256()

    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def to_decimal_degrees(value: Any) -> float:
    """Convert EXIF GPS degrees/minutes/seconds into decimal degrees."""
    degrees, minutes, seconds = value

    def number(item: Any) -> float:
        if hasattr(item, "numerator") and hasattr(item, "denominator"):
            if item.denominator == 0:
                raise ValueError("Invalid GPS coordinate denominator")
            return float(item.numerator) / float(item.denominator)

        return float(item)

    return number(degrees) + number(minutes) / 60 + number(seconds) / 3600


def extract_gps(exif: Any) -> dict[str, float] | None:
    """Extract latitude and longitude from image EXIF metadata."""
    try:
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        gps = {
            GPS_TAGS.get(tag, tag): value
            for tag, value in gps_ifd.items()
        }

        latitude = gps.get("GPSLatitude")
        longitude = gps.get("GPSLongitude")
        lat_ref = gps.get("GPSLatitudeRef")
        lon_ref = gps.get("GPSLongitudeRef")

        if (
            latitude is None
            or longitude is None
            or lat_ref is None
            or lon_ref is None
        ):
            return None

        lat = to_decimal_degrees(latitude)
        lon = to_decimal_degrees(longitude)

        if str(lat_ref).upper() == "S":
            lat = -lat
        elif str(lat_ref).upper() != "N":
            return None

        if str(lon_ref).upper() == "W":
            lon = -lon
        elif str(lon_ref).upper() != "E":
            return None

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return None

        return {"latitude": lat, "longitude": lon}

    except (KeyError, TypeError, ValueError, AttributeError, ZeroDivisionError):
        return None


def haversine_distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate the great-circle distance between two coordinates in metres."""
    earth_radius_m = 6_371_000

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )

    # Guard against floating-point rounding errors.
    a = min(1.0, max(0.0, a))

    return 2 * earth_radius_m * math.asin(math.sqrt(a))


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
      PASS       - check passed
      WARNING    - missing or inconclusive information
      FAIL       - configured validation failed
      NOT_CHECKED - check could not be performed
    """
    path = Path(file_path)
    uploaded_at = utc_datetime(uploaded_at or datetime.now(timezone.utc))

    checks: list[dict[str, Any]] = []

    # Validate configuration.
    if not (-90 <= site_latitude <= 90):
        raise ValueError("site_latitude must be between -90 and 90")

    if not (-180 <= site_longitude <= 180):
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
        # EXIF timestamps have no timezone by themselves.
        # The configured interpretation here is UTC.
        capture_utc = capture_time.replace(tzinfo=timezone.utc)
        delay_hours = (
            uploaded_at - capture_utc
        ).total_seconds() / 3600

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

    # GPS coordinates and site geofence.
    gps = extract_gps(exif) if metadata_read else None

    if not metadata_read:
        checks.append(
            make_check(
                "gps_geofence",
                "NOT_CHECKED",
                "GPS could not be inspected because metadata was unreadable.",
            )
        )
    elif gps is None:
        checks.append(
            make_check(
                "gps_geofence",
                "WARNING",
                "GPS coordinates are missing or invalid; site distance cannot be verified.",
            )
        )
    else:
        distance = haversine_distance_m(
            gps["latitude"],
            gps["longitude"],
            site_latitude,
            site_longitude,
        )

        inside_radius = distance <= site_radius_m

        checks.append(
            make_check(
                "gps_geofence",
                "PASS" if inside_radius else "FAIL",
                (
                    "Photo GPS is within the configured site radius."
                    if inside_radius
                    else "Photo GPS is outside the configured site radius."
                ),
                photo_latitude=gps["latitude"],
                photo_longitude=gps["longitude"],
                site_latitude=site_latitude,
                site_longitude=site_longitude,
                distance_from_site_m=round(distance, 2),
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
        "disclaimer": (
            "EXIF and GPS results are signals, not proof of fraud. "
            "Metadata can be absent, altered, or spoofed. Combine these "
            "results with visual verification and human review."
        ),
    }
