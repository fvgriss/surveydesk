-- Smart Inbox: add AI classification and triage columns to email_log
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS body_full TEXT;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS ai_classification VARCHAR(50);
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS ai_suggestion JSONB;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) NOT NULL DEFAULT 'new';
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_log_status_idx ON email_log(tenant_id, email_status);
