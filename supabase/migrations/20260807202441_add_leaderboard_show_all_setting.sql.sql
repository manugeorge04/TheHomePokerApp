/*
# Add leaderboard "show all" setting

1. New Tables
- `app_settings` — single-row key/value table for app-wide toggles.
  - `key` (text, primary key) — setting name
  - `value` (boolean, not null) — setting value
  - `updated_at` (timestamptz) — last change time
  - `updated_by` (uuid) — who changed it (references auth.users)
2. Seed Data
- Inserts `leaderboard_show_all` = false (default: only profitable players shown).
3. Security
- Enable RLS on `app_settings`.
- SELECT: any authenticated user can read (so every player sees the same toggle state).
- INSERT/UPDATE/DELETE: restricted to the admin (display_name = 'MasterManuver') via a subquery on profiles.
4. Important Notes
- This is a display-only flag. Stats collection is unchanged.
- When `leaderboard_show_all` is true, every player (including losers) appears on the profit board.
- When false (default), only players with positive net profit are shown.
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
CREATE POLICY "read_app_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_app_settings" ON app_settings;
CREATE POLICY "admin_insert_app_settings" ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.display_name = 'MasterManuver')
  );

DROP POLICY IF EXISTS "admin_update_app_settings" ON app_settings;
CREATE POLICY "admin_update_app_settings" ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.display_name = 'MasterManuver')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.display_name = 'MasterManuver')
  );

DROP POLICY IF EXISTS "admin_delete_app_settings" ON app_settings;
CREATE POLICY "admin_delete_app_settings" ON app_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.display_name = 'MasterManuver')
  );

INSERT INTO app_settings (key, value)
VALUES ('leaderboard_show_all', false)
ON CONFLICT (key) DO NOTHING;

-- Enable realtime so all clients see toggle changes instantly
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
