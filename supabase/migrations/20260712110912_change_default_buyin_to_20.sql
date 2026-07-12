/*
# Change default preferred_buyin from 100 to 20

1. Purpose
   - New users currently get a default preferred buy-in of 100.
   - Change the column default on profiles.preferred_buyin from 100 to 20
     so new users start with a more standard $20 default.
2. Changes
   - ALTER COLUMN preferred_buyin SET DEFAULT 20 on the profiles table.
   - No data migration of existing users — only the default for NEW rows changes.
     Existing users keep whatever preferred_buyin they already have.
3. Security
   - No RLS / policy changes.
4. Notes
   - Idempotent: SET DEFAULT is safe to run multiple times.
*/

ALTER TABLE profiles ALTER COLUMN preferred_buyin SET DEFAULT 20;
