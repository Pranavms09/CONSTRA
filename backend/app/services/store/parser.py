import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from rapidfuzz import process, fuzz
from sqlalchemy.orm import Session
from app.models.material import Material, Vendor


DATE_FORMATS = [
    (r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", "%d/%m/%Y"),
    (r"\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b", "%Y/%m/%d"),
    (r"\b(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})\b", "%d-%b-%Y"),
]

UNIT_PATTERNS = [
    r"bags?",
    r"kg|kgs|kilograms?",
    r"tonnes?|tons?|mt",
    r"bundles?|nos?|numbers?",
    r"cu\.?m|m3|cum",
    r"sq\.?m|m2|sqm",
]


def extract_challan_number(text: str) -> tuple[Optional[str], float]:
    """Finds challan/DC numbers via regex patterns."""
    patterns = [
        r"(?:challan\s*(?:no\.?|#|num)?|dc\s*(?:no\.?|#)|delivery\s*(?:note|slip|challan)\s*(?:no\.?|#)?|invoice\s*no\.?)\s*[:.-]?\s*([A-Za-z0-9/\-_]{3,30})",
        r"\b(?:DC|CH|DEL|INV)[-_/][0-9A-Za-z/\-_]{3,20}\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1) if match.groups() else match.group(0)
            return val.strip().strip(":-."), 88.0

    # Fallback pattern for alphanumeric code
    code_match = re.search(r"\b[A-Z]{2,4}[-][0-9]{3,8}\b", text)
    if code_match:
        return code_match.group(0).strip(), 65.0

    return None, 40.0


def extract_date(text: str) -> tuple[Optional[str], float]:
    """Extracts date matching common construction paperwork date conventions."""
    for pattern, fmt in DATE_FORMATS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(0).replace(".", "/").replace("-", "/")
            try:
                # Handle month names
                if "%b" in fmt:
                    clean_str = match.group(0).replace("/", "-").replace(" ", "-")
                    dt = datetime.strptime(clean_str, "%d-%b-%Y")
                elif fmt == "%Y/%m/%d":
                    dt = datetime.strptime(date_str, "%Y/%m/%d")
                else:
                    dt = datetime.strptime(date_str, "%d/%m/%Y")
                return dt.strftime("%Y-%m-%d"), 85.0
            except ValueError:
                continue

    return None, 30.0


def extract_vendor_name(text: str) -> tuple[Optional[str], float]:
    """Extracts vendor name from header lines."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    for line in lines[:8]:
        match = re.search(r"(?:vendor|m/s|supplier|from)\s*[:.-]?\s*([A-Za-z0-9 &.,'-]{3,60})", line, re.IGNORECASE)
        if match:
            return match.group(1).strip(), 82.0

    # Fallback to the first non-trivial header line if header contains company-like words
    for line in lines[:4]:
        if any(w in line.lower() for w in ["cement", "steel", "infra", "constructions", "ltd", "pvt", "corp", "industries", "traders"]):
            return line, 68.0

    return lines[0] if lines else None, 50.0


def extract_items(text: str) -> tuple[List[Dict[str, Any]], float]:
    """Extracts line items containing quantity + unit."""
    items = []
    unit_regex = r"(?P<unit>" + "|".join(UNIT_PATTERNS) + r")"
    line_pattern = rf"(?P<desc>[A-Za-z0-9 \-_.,/()&#]+?)\s*[:\-–]?\s*(?P<qty>\d+(?:\.\d+)?)\s*{unit_regex}"

    for line in text.split("\n"):
        match = re.search(line_pattern, line, re.IGNORECASE)
        if match:
            raw_desc = match.group("desc").strip(" -:–.")
            # Strip leading line/serial numbers like "1 ", "1.", "1)", "1 - "
            desc = re.sub(r"^\s*\d+[\s.)\-]+", "", raw_desc).strip() or raw_desc
            qty_str = match.group("qty")
            unit_str = match.group("unit").lower()

            # Normalize units
            if "bag" in unit_str:
                unit = "bag"
            elif "ton" in unit_str or "mt" in unit_str:
                unit = "tonne"
            elif "kg" in unit_str:
                unit = "kg"
            else:
                unit = unit_str

            try:
                qty = float(qty_str)
                # Ignore zero or excessively tiny values that are likely line numbers
                if qty > 0 and len(desc) >= 3:
                    items.append({
                        "material": desc,
                        "qty": qty,
                        "unit": unit
                    })
            except ValueError:
                continue

    avg_conf = 85.0 if items else 45.0
    return items, avg_conf


def parse_challan_text(raw_text: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Parses raw text into structured fields and field-level confidence ratings.
    Optionally matches material and vendor names against database tables using rapidfuzz.
    """
    vendor_raw, vendor_conf = extract_vendor_name(raw_text)
    challan_no, challan_conf = extract_challan_number(raw_text)
    date_str, date_conf = extract_date(raw_text)
    raw_items, items_conf = extract_items(raw_text)

    # Perform database fuzzy matching if session provided
    matched_items = []
    if db:
        db_materials = {m.name: m for m in db.query(Material).all()}
        material_names = list(db_materials.keys())

        for item in raw_items:
            # Normalize common construction abbreviations and punctuation
            norm_name = re.sub(r"[-_/]", " ", item["material"])
            norm_name = re.sub(r"\bcmt\b", "cement", norm_name, flags=re.IGNORECASE)
            norm_name = re.sub(r"\brbr\b", "rebar", norm_name, flags=re.IGNORECASE)
            norm_name = re.sub(r"\bbars?\b", "rebar", norm_name, flags=re.IGNORECASE)

            best_match = process.extractOne(
                norm_name,
                material_names,
                scorer=fuzz.token_set_ratio
            ) if material_names else None

            if best_match and best_match[1] >= 65:
                matched_mat = db_materials[best_match[0]]
                matched_items.append({
                    "material": matched_mat.name,
                    "material_id": matched_mat.id,
                    "qty": item["qty"],
                    "unit": item["unit"],
                    "field_confidence": round(float(best_match[1]), 1)
                })
            else:
                matched_items.append({
                    "material": item["material"],
                    "material_id": None,
                    "qty": item["qty"],
                    "unit": item["unit"],
                    "field_confidence": 55.0  # low confidence flag
                })
    else:
        for item in raw_items:
            matched_items.append({
                "material": item["material"],
                "material_id": None,
                "qty": item["qty"],
                "unit": item["unit"],
                "field_confidence": 75.0
            })

    # Default fallback items if none detected
    if not matched_items:
        matched_items = [{"material": "", "qty": 0, "unit": "bag", "field_confidence": 30.0}]

    return {
        "fields": {
            "vendor": vendor_raw or "",
            "challan_no": challan_no or "",
            "date": date_str or "",
            "items": matched_items
        },
        "confidence_per_field": {
            "vendor": round(vendor_conf, 1),
            "challan_no": round(challan_conf, 1),
            "date": round(date_conf, 1),
            "items": round(items_conf, 1)
        }
    }
