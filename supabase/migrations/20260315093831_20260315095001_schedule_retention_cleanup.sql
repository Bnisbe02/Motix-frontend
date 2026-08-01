/*
  # Schedule Data Retention Cleanup

  SOC2 CC6 — Data Retention Enforcement

  NOTE: This migration requires the pg_cron extension to be enabled first.
  If pg_cron is not available, this is a documentation placeholder only.

  Step 1: Enable pg_cron in Supabase Dashboard
    → Database → Extensions → search "pg_cron" → Enable

  Step 2: Run this SQL manually in the Supabase SQL Editor:

    SELECT cron.schedule(
      'motix-data-retention-cleanup',
      '0 2 * * *',
      $$SELECT cleanup_expired_data()$$
    );

  This schedules cleanup_expired_data() to run daily at 2:00 AM UTC.

  Enforces:
  - access_log: deleted after 90 days
  - contact_submissions: deleted after 12 months

  Verify the schedule was created:
    SELECT * FROM cron.job WHERE jobname = 'motix-data-retention-cleanup';

  To test immediately:
    SELECT cleanup_expired_data();
*/

-- No-op placeholder - actual cron scheduling must be done after enabling pg_cron extension
SELECT 1;
