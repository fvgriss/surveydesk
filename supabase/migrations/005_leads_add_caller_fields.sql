-- Add caller contact info and special requests to leads table
-- These fields are denormalized from contacts for quick access in the intake UI

ALTER TABLE leads ADD COLUMN IF NOT EXISTS caller_email VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS caller_phone VARCHAR(20);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS special_requests TEXT;
