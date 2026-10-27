-- CONSTRA / SiteVerify schema for Cloudflare D1 (SQLite).
-- Timestamps are ISO-8601 UTC strings; booleans are 0/1 integers.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor', 'store_incharge', 'auditor')),
  password_hash TEXT,
  firebase_uid TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'google',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE image_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT,
  description TEXT NOT NULL,
  model TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'backend_gemini_vision',
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_image_analyses_file_hash ON image_analyses(file_hash);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  site_address TEXT,
  centroid_lat REAL,
  centroid_lng REAL,
  site_radius_m REAL NOT NULL DEFAULT 200.0,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  UNIQUE (project_id, user_id)
);

CREATE TABLE project_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  boq_tolerance_pct REAL NOT NULL DEFAULT 5.0,
  expected_usage_tolerance REAL NOT NULL DEFAULT 0.15,
  zscore_limit REAL NOT NULL DEFAULT 2.5,
  allow_new_vendors INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  verified_progress REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  base_unit TEXT NOT NULL,
  description TEXT
);

CREATE TABLE unit_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  factor_to_base REAL NOT NULL
);

CREATE TABLE vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_approved INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE boq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  planned_qty REAL NOT NULL,
  unit TEXT NOT NULL,
  planned_qty_base REAL NOT NULL
);

CREATE TABLE challans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name_raw TEXT,
  challan_no TEXT NOT NULL,
  challan_date TEXT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  ocr_raw_text TEXT,
  ocr_confidence REAL,
  reviewed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  failure_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (vendor_id, challan_no)
);
CREATE INDEX ix_challans_sha256 ON challans(sha256);

CREATE TABLE challan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challan_id INTEGER NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  material_name_raw TEXT,
  qty REAL NOT NULL,
  unit TEXT NOT NULL,
  qty_base REAL NOT NULL,
  field_confidence REAL
);

CREATE TABLE material_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE RESTRICT,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  qty REAL NOT NULL,
  unit TEXT NOT NULL,
  qty_base REAL NOT NULL,
  issued_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_to TEXT NOT NULL,
  note TEXT,
  anomaly_flag INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  challan_id INTEGER REFERENCES challans(id) ON DELETE SET NULL,
  issue_id INTEGER REFERENCES material_issues(id) ON DELETE SET NULL,
  photo_id INTEGER,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  explanation TEXT NOT NULL,
  evidence TEXT,
  auditor_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_alerts_project ON alerts(project_id);

CREATE TABLE evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_evidence_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_url TEXT,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  client_sha256 TEXT NOT NULL,
  server_sha256 TEXT NOT NULL,
  hash_matched INTEGER NOT NULL DEFAULT 1,
  captured_at TEXT NOT NULL,
  server_received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_m REAL NOT NULL,
  distance_to_site_m REAL,
  is_within_radius INTEGER NOT NULL DEFAULT 1,
  radius_warning INTEGER NOT NULL DEFAULT 0,
  blockchain_tx TEXT,
  blockchain_status TEXT NOT NULL DEFAULT 'queued',
  blockchain_block_number INTEGER,
  blockchain_network TEXT NOT NULL DEFAULT 'sepolia',
  blockchain_chain_id INTEGER NOT NULL DEFAULT 11155111,
  ai_status TEXT NOT NULL DEFAULT 'pending',
  ai_summary TEXT,
  ai_report TEXT,
  ai_structured_result TEXT,
  ai_analyzed_at TEXT,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'VERIFIED_SUBMITTED',
  notes TEXT
);
CREATE INDEX ix_evidence_supervisor ON evidence(supervisor_id);
CREATE INDEX ix_evidence_server_sha256 ON evidence(server_sha256);

CREATE TABLE clearance_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_number TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  claim_id TEXT,
  auditor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verdict TEXT NOT NULL DEFAULT 'CLEARED',
  verdict_note TEXT,
  evidence_hashes TEXT,
  verification_summary TEXT,
  certificate_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Formerly a JSON file (claims_store.json) and Firestore 'claims'; the claim body is a JSON document.
CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Formerly in-memory JOBS_DB.
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

-- Formerly Firestore 'chain_anchors'. Anchoring is simulated (CHAIN_MODE=fake).
CREATE TABLE chain_anchors (
  sha256 TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  project_id TEXT,
  kind INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  chain_id INTEGER,
  block_number INTEGER,
  anchored_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  simulated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ix_chain_anchors_entity ON chain_anchors(entity, entity_id);
