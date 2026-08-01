/*
  # Create chat_usage table for rate limiting

  Tracks per-user message counts to enforce the 100 messages/hour limit
  on the chat Edge Function.
*/

CREATE TABLE IF NOT EXISTS chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient per-user time-range queries
CREATE INDEX IF NOT EXISTS chat_usage_user_created_idx ON chat_usage(user_id, created_at);

-- RLS: users cannot read or write their own usage records directly
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

-- No client-side policies — this table is written to only by the service role
-- in the chat Edge Function. No SELECT policy needed.
