/*
  # Access Log Table

  SOC2 CC6 — Logical Access Controls
  Records every authenticated data access event for audit purposes.
  Written to by Edge Functions using the service role only.
  No client-side read or write policies — admin access via service role only.

  retention_policy: 90 days (enforced by scheduled cleanup — see migration 20260315090001)
*/

CREATE TABLE IF NOT EXISTS access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  event_type text NOT NULL,
  resource text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX access_log_user_idx ON access_log(user_id, created_at DESC);
CREATE INDEX access_log_event_idx ON access_log(event_type, created_at DESC);
CREATE INDEX access_log_created_idx ON access_log(created_at DESC);

ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE access_log IS 'SOC2 audit log — immutable record of authenticated data access events. Written by service role only.';
