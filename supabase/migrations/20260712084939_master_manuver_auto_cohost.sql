/*
# Auto-cohost Master Manuver on session join

1. Purpose
   - Whenever the user "Master Manuver" (profile id d4212629-32ba-4f79-9613-eb85571b542c)
     is inserted as a session_player, automatically set is_cohost = true.
   - This makes them a co-host by default in every session they join, even ones
     created by other users. It does NOT make them the host (host_id on sessions
     is unchanged) — only a co-host, so they get host/co-host privileges in the UI.
2. Changes
   - New function: set_master_manuver_cohost() — BEFORE INSERT trigger on session_players
     that sets NEW.is_cohost = true when NEW.user_id matches the target profile id.
   - New trigger: trg_set_master_manuver_cohost fired BEFORE INSERT ON session_players.
   - Data backfill: UPDATE existing session_players rows for the target user so any
     sessions they already joined are retroactively co-hosted.
3. Security
   - No RLS / policy changes. The trigger runs with definer privileges (SECURITY
     DEFINER) so it can set is_cohost regardless of the caller's role, while the
     function body only ever acts on the single hard-coded user id.
4. Notes
   - The target user id is hard-coded to d4212629-32ba-4f79-9613-eb85571b542c.
   - The function is idempotent: re-running the migration drops & recreates the
     trigger and function safely.
*/

-- Backfill: set existing rows for Master Manuver to co-host
UPDATE session_players
SET is_cohost = true
WHERE user_id = 'd4212629-32ba-4f79-9613-eb85571b542c';

-- Trigger function: force is_cohost = true on insert for Master Manuver
CREATE OR REPLACE FUNCTION set_master_manuver_cohost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = 'd4212629-32ba-4f79-9613-eb85571b542c' THEN
    NEW.is_cohost := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-running, then create
DROP TRIGGER IF EXISTS trg_set_master_manuver_cohost ON session_players;
CREATE TRIGGER trg_set_master_manuver_cohost
BEFORE INSERT ON session_players
FOR EACH ROW
EXECUTE FUNCTION set_master_manuver_cohost();
