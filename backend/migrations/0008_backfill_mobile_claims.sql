-- Mobile app photos uploaded before they auto-joined claims: one UNDER_REVIEW claim per supervisor + project + stage,
-- same shape as attachEvidenceToClaim (src/routes/claims.ts). Photos already in a claim and CLEARED stages are skipped.
WITH loose AS (
  SELECT e.* FROM evidence e JOIN stages s ON s.id = e.stage_id
  WHERE s.status != 'CLEARED'
    AND NOT EXISTS (SELECT 1 FROM claims c, json_each(c.data, '$.files') f WHERE json_extract(f.value, '$.evidence_id') = e.id)
),
grp AS (
  SELECT supervisor_id, project_id, stage_id, MIN(id) AS first_id,
    MAX(CASE WHEN hash_matched = 0 OR is_within_radius = 0 THEN 1 ELSE 0 END) AS risky,
    json_group_array(json_object(
      'id', 'EV-' || id, 'kind', 'photo', 'name', original_filename, 'url', '/supervisor/evidence/' || id || '/file', 'key', file_path,
      'sha256', server_sha256, 'evidence_id', id, 'source', 'mobile_app', 'captured_at', captured_at, 'latitude', latitude,
      'longitude', longitude, 'accuracy_m', accuracy_m, 'distance_to_site_m', distance_to_site_m,
      'within_radius', json(CASE WHEN is_within_radius THEN 'true' ELSE 'false' END),
      'hash_matched', json(CASE WHEN hash_matched THEN 'true' ELSE 'false' END)
    )) AS files
  FROM loose GROUP BY supervisor_id, project_id, stage_id
)
INSERT INTO claims (id, data)
SELECT 'CLM-MOB' || g.first_id, json_object(
  'id', 'CLM-MOB' || g.first_id, 'claimant', COALESCE(NULLIF(u.full_name, ''), u.email), 'submitter_id', u.id, 'submitter_email', u.email,
  'policy_no', 'POL-INSP-MOBILE', 'project_id', CAST(g.project_id AS TEXT), 'stage_id', g.stage_id, 'type', s.name,
  'filed_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'risk', CASE WHEN g.risky THEN 'HIGH' ELSE 'LOW' END, 'status', 'UNDER_REVIEW',
  'files', json(g.files),
  'ai', json_object(
    'sha256', f.server_sha256,
    'gps_distance_m', json_object('fieldKey', 'gps_distance_m', 'value', COALESCE(f.distance_to_site_m, 0), 'confidence', 0.9,
      'source', 'Device GPS at capture (server geofence)', 'source_ref', f.original_filename),
    'inspection_date', json_object('fieldKey', 'inspection_date', 'value', substr(f.captured_at, 1, 10), 'confidence', 0.9,
      'source', 'Device capture time', 'source_ref', f.original_filename)),
  'decisions', json_object(), 'line_items', json_array(), 'report', json('null'))
FROM grp g JOIN users u ON u.id = g.supervisor_id JOIN stages s ON s.id = g.stage_id JOIN evidence f ON f.id = g.first_id
WHERE NOT EXISTS (SELECT 1 FROM claims WHERE id = 'CLM-MOB' || g.first_id);

UPDATE stages SET status = 'UNDER_REVIEW'
WHERE status != 'CLEARED' AND id IN (SELECT json_extract(data, '$.stage_id') FROM claims WHERE id LIKE 'CLM-MOB%' AND json_extract(data, '$.status') = 'UNDER_REVIEW');
