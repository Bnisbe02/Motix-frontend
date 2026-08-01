/*
  # Multi-tenant Row Level Security

  Adds agency_id isolation to core data tables.
  
  DEPLOYMENT NOTE: This migration assumes the following tables exist
  with the specified columns. If detections or bookings tables do not
  yet exist, this migration should be run after they are created.
  
  The agency_id value is read from the user's JWT app_metadata claim.
  Set this claim in Supabase Dashboard → Authentication → Users → 
  Edit user → app_metadata: { "agency_id": "bastion" }
  
  Or via the Supabase Admin API when provisioning new users.
*/

-- Helper function to extract agency_id from JWT
CREATE OR REPLACE FUNCTION get_agency_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>'app_metadata',
    '{}'
  )::json->>'agency_id'
$$;

-- ============================================================
-- DETECTIONS TABLE
-- ============================================================
-- Assumes detections table has an agency_id column.
-- If it does not exist yet, add it:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detections') THEN
    ALTER TABLE detections ADD COLUMN IF NOT EXISTS agency_id text;
    ALTER TABLE detections ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users see own agency detections" ON detections;
    CREATE POLICY "Users see own agency detections"
      ON detections FOR SELECT
      TO authenticated
      USING (agency_id = get_agency_id());
  END IF;
END $$;

-- The detections table is written to by the backend pipeline
-- using the service role key — no INSERT policy needed for client.

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agency_id text;
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users see own agency bookings" ON bookings;
    CREATE POLICY "Users see own agency bookings"
      ON bookings FOR SELECT
      TO authenticated
      USING (agency_id = get_agency_id());
    
    DROP POLICY IF EXISTS "Users insert own agency bookings" ON bookings;
    CREATE POLICY "Users insert own agency bookings"
      ON bookings FOR INSERT
      TO authenticated
      WITH CHECK (agency_id = get_agency_id());
  END IF;
END $$;

-- ============================================================
-- DEPLOYMENT CHECKLIST (add as comment for ops reference)
-- ============================================================
-- 1. Run this migration after detections and bookings tables exist
-- 2. Set agency_id on all existing rows before enabling policies
--    UPDATE detections SET agency_id = 'bastion' WHERE agency_id IS NULL;
--    UPDATE bookings SET agency_id = 'bastion' WHERE agency_id IS NULL;
-- 3. Set JWT app_metadata for all existing users in Supabase Dashboard
-- 4. Test with a second user from a different agency before going live
