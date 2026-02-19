-- 008: Add subscription fields to tenants for Stripe billing
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'starter';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
