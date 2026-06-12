
-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferred_buyin INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'Poker Night',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  accounting_difference NUMERIC(10,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sessions" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "update_sessions" ON sessions FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "delete_sessions" ON sessions FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- Session players
CREATE TABLE session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  total_buyin NUMERIC(10,2) DEFAULT 0,
  cashout NUMERIC(10,2),
  result NUMERIC(10,2),
  position INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_session_players" ON session_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_session_players" ON session_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_session_players" ON session_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_session_players" ON session_players FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.host_id = auth.uid())
);

-- Buy-ins (includes rebuys via is_rebuy flag)
CREATE TABLE buy_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_player_id UUID NOT NULL REFERENCES session_players(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  is_rebuy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buy_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_buy_ins" ON buy_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_buy_ins" ON buy_ins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_buy_ins" ON buy_ins FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_buy_ins" ON buy_ins FOR DELETE TO authenticated USING (true);

-- Cash-outs
CREATE TABLE cash_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_player_id UUID NOT NULL REFERENCES session_players(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_cash_outs" ON cash_outs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_cash_outs" ON cash_outs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_cash_outs" ON cash_outs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cash_outs" ON cash_outs FOR DELETE TO authenticated USING (true);

-- Approvals (for accounting discrepancies)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  difference NUMERIC(10,2),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_approvals" ON approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_approvals" ON approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() = approved_by);
CREATE POLICY "update_approvals" ON approvals FOR UPDATE TO authenticated USING (auth.uid() = approved_by) WITH CHECK (auth.uid() = approved_by);
CREATE POLICY "delete_approvals" ON approvals FOR DELETE TO authenticated USING (auth.uid() = approved_by);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
