
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  BEGIN
    base_username := regexp_replace(
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1),
        'player'
      ),
      '[^a-zA-Z0-9_]', '', 'g'
    );
    IF base_username = '' THEN
      base_username := 'player';
    END IF;

    final_username := base_username;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username);
      counter := counter + 1;
      final_username := base_username || counter::text;
    END LOOP;

    INSERT INTO public.profiles (id, display_name, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Player'),
      final_username
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow error so auth signup is never blocked by profile creation
    NULL;
  END;
  RETURN NEW;
END;
$$;
