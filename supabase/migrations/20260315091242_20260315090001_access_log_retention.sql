/*
  # Access Log Retention Policy

  SOC2 CC6 — Data Retention
  Deletes access_log entries older than 90 days.

  In Supabase, schedule this via the pg_cron extension:
    SELECT cron.schedule(
      'access-log-cleanup',
      '0 2 * * *',
      $$DELETE FROM access_log WHERE created_at < now() - interval '90 days'$$
    );

  If pg_cron is not available, run this SQL manually on a schedule
  or call the cleanup Edge Function via a cron service (e.g. cron-job.org).
*/

-- Contact submissions retention: 12 months (per privacy policy)
-- Run this alongside the access_log cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM access_log WHERE created_at < now() - interval '90 days';
  DELETE FROM contact_submissions WHERE created_at < now() - interval '12 months';
$$;

COMMENT ON FUNCTION cleanup_expired_data IS 'SOC2 data retention enforcement. Schedule daily via pg_cron or external cron.';
