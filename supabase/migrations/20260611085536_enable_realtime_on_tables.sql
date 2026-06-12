
-- Enable real-time on tables used by postgres_changes subscriptions.
-- REPLICA IDENTITY FULL is required so filters on non-PK columns (e.g. session_id)
-- work correctly for UPDATE and DELETE events.

ALTER TABLE sessions        REPLICA IDENTITY FULL;
ALTER TABLE session_players REPLICA IDENTITY FULL;
ALTER TABLE buy_ins         REPLICA IDENTITY FULL;
ALTER TABLE cash_outs       REPLICA IDENTITY FULL;
ALTER TABLE approvals       REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE buy_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_outs;
ALTER PUBLICATION supabase_realtime ADD TABLE approvals;
