/*
  # PCR Phase 1 — Station registry

  Shared, read-only registry of broadcast stations the MOTIX pipeline
  monitors. The `callsign` is the pipeline identifier used in detections
  (e.g. '2QN_Deniliquin', 'NOVA969'); `display_name` is what reports show.

  Tenancy: this table is NOT agency-scoped. Every authenticated user can
  read it. There are deliberately no INSERT/UPDATE/DELETE policies for
  `authenticated` — writes come only from the service role (which bypasses
  RLS), i.e. the backend pipeline or an operator in the SQL editor.

  Timezones are IANA names so daypart windows can be resolved per station
  when a report spans markets (Perth is +2/+3h behind Sydney).
*/

CREATE TABLE IF NOT EXISTS stations (
  callsign      text PRIMARY KEY,           -- pipeline identifier, e.g. '2QN_Deniliquin', 'NOVA969'
  display_name  text NOT NULL,              -- e.g. 'Nova 96.9'
  market        text NOT NULL,              -- e.g. 'Sydney'
  state         text NOT NULL,              -- 'NSW','VIC','QLD','SA','WA','TAS','NT','ACT'
  timezone      text NOT NULL,              -- IANA, e.g. 'Australia/Sydney'
  network       text,                       -- e.g. 'Nova Entertainment'
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read stations" ON stations;
CREATE POLICY "authenticated read stations"
  ON stations FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- SEED: Nova metro network + 2QN Deniliquin
-- ============================================================
INSERT INTO stations (callsign, display_name, market, state, timezone, network)
VALUES
  ('NOVA969',        'Nova 96.9',  'Sydney',     'NSW', 'Australia/Sydney',    'Nova Entertainment'),
  ('NOVA100',        'Nova 100',   'Melbourne',  'VIC', 'Australia/Melbourne', 'Nova Entertainment'),
  ('NOVA1069',       'Nova 106.9', 'Brisbane',   'QLD', 'Australia/Brisbane',  'Nova Entertainment'),
  ('NOVA919',        'Nova 91.9',  'Adelaide',   'SA',  'Australia/Adelaide',  'Nova Entertainment'),
  ('NOVA937',        'Nova 93.7',  'Perth',      'WA',  'Australia/Perth',     'Nova Entertainment'),
  ('2QN_Deniliquin', '2QN 1521',   'Deniliquin', 'NSW', 'Australia/Sydney',    NULL)
ON CONFLICT (callsign) DO NOTHING;
