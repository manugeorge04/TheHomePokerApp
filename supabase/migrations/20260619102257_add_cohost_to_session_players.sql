-- Add is_cohost column to session_players
ALTER TABLE session_players ADD COLUMN is_cohost BOOLEAN DEFAULT FALSE;

-- Update sessions RLS to allow co-hosts to update/delete
DROP POLICY "update_sessions" ON sessions;
DROP POLICY "delete_sessions" ON sessions;

CREATE POLICY "update_sessions" ON sessions FOR UPDATE TO authenticated 
  USING (auth.uid() = host_id OR EXISTS (
    SELECT 1 FROM session_players sp 
    WHERE sp.session_id = sessions.id 
    AND sp.user_id = auth.uid() 
    AND sp.is_cohost = TRUE
  ))
  WITH CHECK (auth.uid() = host_id OR EXISTS (
    SELECT 1 FROM session_players sp 
    WHERE sp.session_id = sessions.id 
    AND sp.user_id = auth.uid() 
    AND sp.is_cohost = TRUE
  ));

CREATE POLICY "delete_sessions" ON sessions FOR DELETE TO authenticated 
  USING (auth.uid() = host_id OR EXISTS (
    SELECT 1 FROM session_players sp 
    WHERE sp.session_id = sessions.id 
    AND sp.user_id = auth.uid() 
    AND sp.is_cohost = TRUE
  ));

-- Update session_players RLS to allow co-hosts to delete players
DROP POLICY "delete_session_players" ON session_players;

CREATE POLICY "delete_session_players" ON session_players FOR DELETE TO authenticated 
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.host_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM session_players sp 
      WHERE sp.session_id = session_players.session_id 
      AND sp.user_id = auth.uid() 
      AND sp.is_cohost = TRUE
    )
  );

-- Allow co-hosts to update session_players (for promotions)
CREATE POLICY "update_session_players_cohost" ON session_players FOR UPDATE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.host_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM session_players sp 
      WHERE sp.session_id = session_players.session_id 
      AND sp.user_id = auth.uid() 
      AND sp.is_cohost = TRUE
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.host_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM session_players sp 
      WHERE sp.session_id = session_players.session_id 
      AND sp.user_id = auth.uid() 
      AND sp.is_cohost = TRUE
    )
  );