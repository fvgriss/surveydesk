-- Super Admins table (platform-level, not tenant-scoped)
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS super_admins_auth_idx ON super_admins (auth_id);
CREATE INDEX IF NOT EXISTS super_admins_email_idx ON super_admins (email);

-- Seed: make vance@terrainplot.com a super admin
-- This looks up the auth user ID automatically from Supabase auth.users
INSERT INTO super_admins (auth_id, email, full_name, is_active)
SELECT
  id AS auth_id,
  'vance@terrainplot.com' AS email,
  'Vance Grissom' AS full_name,
  true AS is_active
FROM auth.users
WHERE email = 'vance@terrainplot.com'
ON CONFLICT (auth_id) DO NOTHING;
