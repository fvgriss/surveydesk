-- 007: Add onboarding_complete flag to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
