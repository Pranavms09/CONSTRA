-- Demo data (formerly bootstrap_admin() + scripts/seed_store_demo.py run at FastAPI startup).

INSERT INTO users (email, full_name, role, is_active, firebase_uid, auth_provider) VALUES
  ('supervisor@siteverify.com', 'Alice Supervisor', 'supervisor', 1, 'uid_supervisor', 'demo'),
  ('store@siteverify.com', 'Bob Storekeeper', 'store_incharge', 1, 'uid_store_incharge', 'demo'),
  ('auditor@siteverify.com', 'Carol Auditor', 'auditor', 1, 'uid_auditor', 'demo');

INSERT INTO projects (name, site_address, centroid_lat, centroid_lng, site_radius_m) VALUES
  ('Pune Vidyarthi Griha''s College of Engineering, Nashik',
   '206, Dindori Road, Behind Reliance Petrol Pump, Mhasrul, Nashik, Maharashtra 422004',
   20.03639, 73.79959, 500.0);

INSERT INTO project_members (project_id, user_id, role)
  SELECT 1, id, role FROM users WHERE email IN ('store@siteverify.com', 'supervisor@siteverify.com', 'auditor@siteverify.com');

INSERT INTO project_settings (project_id, boq_tolerance_pct, expected_usage_tolerance, zscore_limit, allow_new_vendors)
  VALUES (1, 5.0, 0.15, 2.5, 1);

INSERT INTO stages (project_id, name, "order", status, verified_progress) VALUES
  (1, 'Substructure / Foundation', 1, 'COMPLETED', 1.0),
  (1, 'Ground Floor RCC Slab', 2, 'COMPLETED', 1.0),
  (1, 'First Floor Columns & Beams', 3, 'IN_PROGRESS', 0.4);

INSERT INTO materials (name, base_unit, description) VALUES
  ('OPC 53 Cement', 'kg', 'Ordinary Portland Cement 53 Grade - ISI Certified'),
  ('TMT Steel Rebar 12mm', 'kg', 'Thermo Mechanically Treated Rebar 12mm Fe500D');

INSERT INTO unit_conversions (material_id, unit, factor_to_base) VALUES
  (1, 'kg', 1.0), (1, 'bag', 50.0), (1, 'tonne', 1000.0),
  (2, 'kg', 1.0), (2, 'bundle', 50.0), (2, 'tonne', 1000.0);

INSERT INTO boq_items (project_id, stage_id, material_id, planned_qty, unit, planned_qty_base) VALUES
  (1, 1, 1, 10000.0, 'kg', 10000.0),
  (1, 1, 2, 4000.0, 'kg', 4000.0),
  (1, 2, 1, 15000.0, 'kg', 15000.0),
  (1, 2, 2, 6000.0, 'kg', 6000.0),
  (1, 3, 1, 15000.0, 'kg', 15000.0),
  (1, 3, 2, 6000.0, 'kg', 6000.0);

INSERT INTO vendors (name, is_approved) VALUES
  ('UltraTech Building Solutions', 1),
  ('Shree Cement Traders', 0);

INSERT INTO alerts (project_id, stage_id, type, severity, status, explanation, evidence) VALUES
  (1, 3, 'BOQ_QUANTITY_OVERRUN', 'high', 'open',
   'Delivery challan #CH-8821 contains OPC 53 Cement exceeding Stage 3 planned baseline by 12%. Requires auditor reconciliation.',
   '{"material": "OPC 53 Cement", "excess_qty": 1000, "unit": "kg", "variance_pct": 12.5}');
