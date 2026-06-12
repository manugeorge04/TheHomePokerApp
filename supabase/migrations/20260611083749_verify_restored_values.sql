
-- Sanity check: confirm restored values match the pre-fix snapshot
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT sp.display_name, sp.total_buyin, sp.result, s.title
    FROM session_players sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.id IN (
      '3c0c91d9-29d8-463a-9fa3-0914ce8eb8c5',
      'dc70bbf2-9f12-403a-883c-d344fad45234',
      '1d786423-b9a5-4eb8-b45a-614d27596c05',
      '4d02957b-2259-4e7a-ba84-90556e06c54f',
      'afec37f1-9f6e-4408-a4e7-bc9b7a5a43d8'
    )
  LOOP
    RAISE NOTICE '% | % | total_buyin=% result=%', r.title, r.display_name, r.total_buyin, r.result;
  END LOOP;
END $$;
