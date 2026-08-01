/*
  # RLS Deployment Note
  
  The multi-tenant RLS policies added in 20260315070000 are INACTIVE
  until agency_id values are populated on existing rows and JWT
  app_metadata claims are set on existing users.
  
  Run the following AFTER populating agency_id on all rows:
  
  -- Verify no rows will be hidden from existing users:
  SELECT COUNT(*) FROM detections WHERE agency_id IS NULL;
  SELECT COUNT(*) FROM bookings WHERE agency_id IS NULL;
  
  -- Both should return 0 before the policies become meaningful.
  
  This migration is a no-op placeholder to document the deployment
  sequence in the migration history.
*/

SELECT 1;
