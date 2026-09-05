BEGIN;

CREATE TABLE IF NOT EXISTS workspace_environment_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  smtp_url_encrypted text,
  mail_from text,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
