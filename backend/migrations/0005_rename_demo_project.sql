-- Rename the seeded demo project (same Nashik geofence).
UPDATE projects
SET name = 'Shree Construction, Nashik',
    site_address = 'Shree Construction Site, Dindori Road, Mhasrul, Nashik, Maharashtra 422004'
WHERE name = 'Pune Vidyarthi Griha''s College of Engineering, Nashik';
