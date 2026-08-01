/*
  # Data Subject Requests Table

  SOC2 Privacy — P8 (User Rights)
  Stores access and deletion requests submitted via the data request form.
  Target response time: 30 days (per privacy policy).
*/

CREATE TABLE IF NOT EXISTS data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('access', 'deletion', 'correction')),
  name text NOT NULL,
  email text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX data_requests_email_idx ON data_requests(email);
CREATE INDEX data_requests_status_idx ON data_requests(status, created_at DESC);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

-- Anonymous insert only — no client reads
CREATE POLICY "Anonymous data requests"
  ON data_requests FOR INSERT
  TO anon
  WITH CHECK (true);

COMMENT ON TABLE data_requests IS 'SOC2 Privacy P8 — data subject access and deletion requests. Respond within 30 days per privacy policy.';
