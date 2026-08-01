/*
  # Admin RLS Policy for access_log

  SOC2 CC6 — Audit Log Access Control

  EXECUTE THIS IN SUPABASE SQL EDITOR — not via migration runner.
  The access_log table has no SELECT policy by design.
  This policy grants read access to the admin user only.

  Run once after deployment:
*/

CREATE POLICY "Admin reads audit log"
  ON access_log
  FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'email' = 'beats@fibrecast.com.au');

/*
  After running this policy, navigate to /admin/audit-log
  while signed in as beats@fibrecast.com.au to verify data is visible.
*/
