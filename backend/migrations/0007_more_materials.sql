-- Common site materials so delivery challan lines (sand, aggregate, bricks, more rebar sizes) can be matched.
INSERT OR IGNORE INTO materials (name, base_unit, description) VALUES
  ('River Sand', 'kg', 'Natural river sand for concrete and plaster'),
  ('M-Sand', 'kg', 'Manufactured sand (crushed stone)'),
  ('20mm Coarse Aggregate', 'kg', 'Crushed stone aggregate, 20 mm nominal'),
  ('PPC Cement', 'kg', 'Portland Pozzolana Cement - ISI Certified'),
  ('TMT Steel Rebar 8mm', 'kg', 'Thermo Mechanically Treated Rebar 8mm Fe500D'),
  ('TMT Steel Rebar 10mm', 'kg', 'Thermo Mechanically Treated Rebar 10mm Fe500D'),
  ('TMT Steel Rebar 16mm', 'kg', 'Thermo Mechanically Treated Rebar 16mm Fe500D'),
  ('Red Clay Bricks', 'nos', 'Standard burnt clay bricks'),
  ('Fly Ash Bricks', 'nos', 'Fly ash bricks');

WITH u(name, unit, factor) AS (VALUES
  ('River Sand', 'kg', 1.0), ('River Sand', 'tonne', 1000.0),
  ('M-Sand', 'kg', 1.0), ('M-Sand', 'tonne', 1000.0),
  ('20mm Coarse Aggregate', 'kg', 1.0), ('20mm Coarse Aggregate', 'tonne', 1000.0),
  ('PPC Cement', 'kg', 1.0), ('PPC Cement', 'bag', 50.0), ('PPC Cement', 'tonne', 1000.0),
  ('TMT Steel Rebar 8mm', 'kg', 1.0), ('TMT Steel Rebar 8mm', 'tonne', 1000.0),
  ('TMT Steel Rebar 10mm', 'kg', 1.0), ('TMT Steel Rebar 10mm', 'tonne', 1000.0),
  ('TMT Steel Rebar 16mm', 'kg', 1.0), ('TMT Steel Rebar 16mm', 'tonne', 1000.0),
  ('Red Clay Bricks', 'nos', 1.0),
  ('Fly Ash Bricks', 'nos', 1.0)
)
INSERT INTO unit_conversions (material_id, unit, factor_to_base)
SELECT m.id, u.unit, u.factor FROM u JOIN materials m ON m.name = u.name
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions uc WHERE uc.material_id = m.id AND uc.unit = u.unit);
