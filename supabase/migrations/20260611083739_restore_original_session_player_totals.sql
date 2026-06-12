
-- Restore 5 rows incorrectly updated by prior automated fix.
-- Original values captured from pre-fix query snapshot.

UPDATE session_players SET total_buyin = 60.00,  result = -40.00  WHERE id = '3c0c91d9-29d8-463a-9fa3-0914ce8eb8c5';  -- TheBook, Poker Night
UPDATE session_players SET total_buyin = 40.00,  result = -40.00  WHERE id = 'dc70bbf2-9f12-403a-883c-d344fad45234';  -- Flames, Poker Night
UPDATE session_players SET total_buyin = 100.00, result = -100.00 WHERE id = '1d786423-b9a5-4eb8-b45a-614d27596c05';  -- TheBook, Poker Night 6/6
UPDATE session_players SET total_buyin = 60.00,  result = 41.30   WHERE id = '4d02957b-2259-4e7a-ba84-90556e06c54f';  -- Flames, Poker Night 6/6
UPDATE session_players SET total_buyin = 40.00,  result = -12.50  WHERE id = 'afec37f1-9f6e-4408-a4e7-bc9b7a5a43d8';  -- Santi, 4/6/26
