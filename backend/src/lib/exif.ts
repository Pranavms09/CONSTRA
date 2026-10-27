import exifr from "exifr";
import { haversineM, sha256Hex } from "./util";

type Status = "PASS" | "WARNING" | "FAIL" | "NOT_CHECKED";
interface Check { name: string; status: Status; message: string; details: Record<string, unknown> }

const check = (name: string, status: Status, message: string, details: Record<string, unknown> = {}): Check => ({ name, status, message, details });

function toDecimal(dms: unknown): number | null {
  if (!Array.isArray(dms) || dms.length !== 3 || dms.some((n) => typeof n !== "number" || !isFinite(n))) return null;
  return dms[0] + dms[1] / 60 + dms[2] / 3600;
}

export function extractGps(tags: Record<string, any>): { latitude: number; longitude: number } | null {
  let lat = toDecimal(tags.GPSLatitude);
  let lon = toDecimal(tags.GPSLongitude);
  const latRef = String(tags.GPSLatitudeRef ?? "").toUpperCase();
  const lonRef = String(tags.GPSLongitudeRef ?? "").toUpperCase();
  if (lat == null || lon == null || !latRef || !lonRef) return null;
  if (latRef === "S") lat = -lat;
  else if (latRef !== "N") return null;
  if (lonRef === "W") lon = -lon;
  else if (lonRef !== "E") return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

/** EXIF "YYYY:MM:DD HH:MM:SS", interpreted as UTC (EXIF carries no timezone). */
function parseCaptureTime(value: unknown): Date | null {
  const m = typeof value === "string" ? value.trim().match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return isNaN(d.getTime()) ? null : d;
}

export interface ExifOptions {
  siteLatitude: number;
  siteLongitude: number;
  uploadedAt?: Date;
  siteRadiusM?: number;
  maxCaptureAgeHours?: number;
  knownHashes?: Set<string>;
  fileName: string;
  /** Precomputed hash of the full file; `bytes` may be only the leading slice that holds the metadata. */
  fileSha256?: string;
}

/** EXIF / GPS / timestamp / editing-software / hash checks (port of checks/exif_gps_analyzer.py). */
export async function analyzeExifGps(bytes: ArrayBuffer, opts: ExifOptions) {
  const { siteLatitude, siteLongitude, siteRadiusM = 200, maxCaptureAgeHours = 24 } = opts;
  const uploadedAt = opts.uploadedAt ?? new Date();
  if (siteLatitude < -90 || siteLatitude > 90) throw new RangeError("site_latitude must be between -90 and 90");
  if (siteLongitude < -180 || siteLongitude > 180) throw new RangeError("site_longitude must be between -180 and 180");
  if (siteRadiusM <= 0 || maxCaptureAgeHours <= 0) throw new RangeError("Site radius and capture age must be positive");

  const checks: Check[] = [];
  const fileHash = opts.fileSha256 ?? (await sha256Hex(bytes));
  const isDuplicate = opts.knownHashes?.has(fileHash) ?? false;
  checks.push(check("sha256_duplicate", isDuplicate ? "FAIL" : "PASS",
    isDuplicate ? "Exact file hash already exists in the supplied hash set." : "No matching hash found in the supplied hash set.",
    { sha256: fileHash }));

  let tags: Record<string, any> | null = null;
  try {
    tags = (await exifr.parse(bytes, { tiff: true, ifd0: true, exif: true, gps: true, reviveValues: false, translateValues: false })) ?? {};
  } catch (exc) {
    checks.push(check("image_metadata", "NOT_CHECKED", "Could not read image metadata.", { error_type: (exc as Error)?.name ?? "Error" }));
  }

  if (!tags) {
    checks.push(check("capture_time", "NOT_CHECKED", "Capture time could not be inspected because metadata was unreadable."));
    checks.push(check("gps_geofence", "NOT_CHECKED", "GPS could not be inspected because metadata was unreadable."));
    checks.push(check("editing_software", "NOT_CHECKED", "Editing-software metadata could not be inspected."));
  } else {
    const hasExif = Object.keys(tags).length > 0;
    checks.push(check("exif_presence", hasExif ? "PASS" : "WARNING", hasExif ? "Standard EXIF metadata is available." : "No standard EXIF tags were found."));

    // exifr names: DateTimeDigitized -> CreateDate, IFD0 DateTime -> ModifyDate.
    const capture = parseCaptureTime(tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate);
    if (!capture) {
      checks.push(check("capture_time", "WARNING", "A usable EXIF capture timestamp is missing."));
    } else {
      const delayHours = (uploadedAt.getTime() - capture.getTime()) / 3_600_000;
      const [status, message]: [Status, string] =
        delayHours < 0 ? ["FAIL", "Capture timestamp is in the future."]
        : delayHours > maxCaptureAgeHours ? ["FAIL", "Photo exceeds the configured capture age."]
        : ["PASS", "Capture time is within the configured time window."];
      checks.push(check("capture_time", status, message, {
        captured_at: capture.toISOString().slice(0, 19),
        uploaded_at: uploadedAt.toISOString(),
        capture_to_upload_hours: Math.round(delayHours * 100) / 100,
        maximum_age_hours: maxCaptureAgeHours,
        timezone_assumption: "UTC",
      }));
    }

    const gps = extractGps(tags);
    if (!gps) {
      checks.push(check("gps_geofence", "WARNING", "GPS coordinates are missing or invalid; site distance cannot be verified."));
    } else {
      const distance = haversineM(gps.latitude, gps.longitude, siteLatitude, siteLongitude);
      const inside = distance <= siteRadiusM;
      checks.push(check("gps_geofence", inside ? "PASS" : "FAIL",
        inside ? "Photo GPS is within the configured site radius." : "Photo GPS is outside the configured site radius.", {
          photo_latitude: gps.latitude, photo_longitude: gps.longitude,
          site_latitude: siteLatitude, site_longitude: siteLongitude,
          distance_from_site_m: Math.round(distance * 100) / 100, site_radius_m: siteRadiusM,
        }));
    }

    const software = tags.Software || tags.ProcessingSoftware;
    checks.push(software
      ? check("editing_software", "WARNING", "Software metadata is present; review it as a possible editing signal.", { software: String(software) })
      : check("editing_software", "PASS", "No editing-software tag was found."));
  }

  const count = (s: Status) => checks.filter((c) => c.status === s).length;
  const failed = count("FAIL"), warnings = count("WARNING"), notChecked = count("NOT_CHECKED");
  return {
    report_type: "EXIF_GPS_ANALYSIS",
    file_name: opts.fileName,
    file_sha256: fileHash,
    generated_at: new Date().toISOString(),
    overall_status: failed ? "FLAGGED" : warnings || notChecked ? "REVIEW_REQUIRED" : "PASS",
    summary: { total_checks: checks.length, passed: count("PASS"), failed, warnings, not_checked: notChecked },
    checks,
    disclaimer:
      "EXIF and GPS results are signals, not proof of fraud. Metadata can be absent, altered, or spoofed. " +
      "Combine these results with visual verification and human review.",
  };
}

export type ExifReport = Awaited<ReturnType<typeof analyzeExifGps>>;
