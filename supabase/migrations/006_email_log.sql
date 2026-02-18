-- Create email_log table for tracking parsed incoming emails
-- Used by Gmail sync integration

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gmail_message_id VARCHAR(100),
  thread_id VARCHAR(100),
  from_address VARCHAR(255),
  from_name VARCHAR(255),
  to_address VARCHAR(255),
  subject TEXT,
  body_preview TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  outcome VARCHAR(50),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_tenant_idx ON email_log(tenant_id);
CREATE INDEX IF NOT EXISTS email_log_date_idx ON email_log(tenant_id, received_at);
CREATE INDEX IF NOT EXISTS email_log_gmail_idx ON email_log(gmail_message_id);
