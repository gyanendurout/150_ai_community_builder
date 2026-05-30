-- Demo user (UUIDs are deterministic for easy reference in code)
INSERT INTO users (id, name, email, phone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Alex Chen', 'alex@joola.demo', '+1-555-0100')
ON CONFLICT (id) DO NOTHING;

-- 5 Joola pickleball courts
INSERT INTO courts (id, name, address, latitude, longitude, indoor_outdoor, source) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Joola Court A',             '123 Pickleball Ave, San Francisco, CA', 37.7749, -122.4194, 'indoor',  'seed'),
  ('00000000-0000-0000-0000-000000000102', 'Joola Court B',             '123 Pickleball Ave, San Francisco, CA', 37.7749, -122.4194, 'indoor',  'seed'),
  ('00000000-0000-0000-0000-000000000103', 'Sunset Recreation Center',  '456 Sunset Blvd, San Francisco, CA',   37.7539, -122.4864, 'outdoor', 'seed'),
  ('00000000-0000-0000-0000-000000000104', 'Mission Pickleball Club',   '789 Mission St, San Francisco, CA',    37.7599, -122.4148, 'indoor',  'seed'),
  ('00000000-0000-0000-0000-000000000105', 'Golden Gate PB Center',     '100 Park Drive, San Francisco, CA',    37.7694, -122.4862, 'outdoor', 'seed')
ON CONFLICT (id) DO NOTHING;

-- Set user home court
UPDATE users SET home_court_id = '00000000-0000-0000-0000-000000000101'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- User profile
INSERT INTO user_profiles (user_id, skill_level, dupr_rating, play_style, visibility, profile_completion_percentage)
VALUES ('00000000-0000-0000-0000-000000000001', 'intermediate', 3.75, 'baseline', 'public', 60)
ON CONFLICT (user_id) DO NOTHING;

-- User memory (AI personalization seed)
-- memory_value_json is JSONB: numbers are bare, strings use JSON encoding ("value")
INSERT INTO user_memory (user_id, memory_type, memory_key, memory_value_json, confidence_score, source) VALUES
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_event_size',     '8',                                              0.95, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_day',            '"Saturday"',                                     0.90, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_time',           '"9:00 AM"',                                      0.90, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_court_id',       '"00000000-0000-0000-0000-000000000101"',          0.95, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_court_name',     '"Joola Court A"',                                0.95, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_event_type',     '"doubles"',                                      0.85, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'preference', 'preferred_duration_hours', '1.5',                                            0.80, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'history',    'events_created_count',     '12',                                             0.99, 'seed'),
  ('00000000-0000-0000-0000-000000000001', 'context',    'user_timezone',            '"America/Los_Angeles"',                          0.99, 'seed')
ON CONFLICT (user_id, memory_key) DO NOTHING;

-- Feature flags
INSERT INTO feature_flags (flag_key, enabled, description, rollout_percentage) VALUES
  ('feature_ai_event_creation',       true,  'AI-powered event creation through chat',    100),
  ('feature_ai_profile_creation',     true,  'AI-powered player profile creation through chat', 100),
  ('feature_ai_tournament_creation',  false, 'AI-powered tournament creation',               0),
  ('feature_weather',                 true,  'Weather integration (stub in POC)',           100),
  ('feature_court_search',            false, 'Real-time court search and availability',      0),
  ('feature_calendar',                false, 'Calendar export and integration',               0),
  ('feature_invites',                 false, 'Automated invite sending',                      0)
ON CONFLICT (flag_key) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      description = EXCLUDED.description,
      rollout_percentage = EXCLUDED.rollout_percentage;

-- ─── PROFILE CREATION FLOW (added in migration 00003) ───────────────────────

-- Complete the demo user's profile with sensible defaults so the detail page
-- and downstream event_creation memory work end-to-end.
UPDATE user_profiles
SET display_name = COALESCE(display_name, 'Alex Chen'),
    status = COALESCE(status, 'active'),
    source = COALESCE(source, 'manual'),
    home_court_id = COALESCE(home_court_id, '00000000-0000-0000-0000-000000000101')
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- Seed the demo user's skill profile so the existing seeded dupr_rating of 3.75
-- and skill_level='intermediate' have a structured home in player_skill_profiles.
INSERT INTO player_skill_profiles (
  user_id, self_rating, dupr_rating, dupr_id, dupr_status,
  app_skill_rating, skill_label, skill_source, style_profile, confidence_score
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  3.5, 3.75, 'DUPR-DEMO-0001', 'found',
  3.4, 'intermediate', 'dupr', 'control_focused_player', 0.9
) ON CONFLICT (user_id) DO NOTHING;

-- Mock DUPR records the dupr.service.ts stub looks up.
INSERT INTO mock_dupr_ratings (dupr_id, full_name, rating) VALUES
  ('DUPR-DEMO-0001', 'Alex Chen',       3.75),
  ('DUPR-DEMO-0002', 'Priya Sharma',    4.10),
  ('DUPR-DEMO-0003', 'Marcus Johnson',  3.20),
  ('DUPR-DEMO-0004', 'Yuki Tanaka',     4.85),
  ('DUPR-DEMO-0005', 'Carlos Reyes',    2.95),
  ('DUPR-DEMO-0006', 'Aanya Patel',     3.50)
ON CONFLICT (dupr_id) DO NOTHING;

-- 10 assessment questions (one per category, sort_order 1..10).
-- options_json shape: [{ value, label, score }]  — score 1..5
INSERT INTO assessment_questions (question_key, question_text, category, sort_order, options_json) VALUES
  ('q01_serve_consistency',
   'How consistently can you land a legal serve in the correct service box?',
   'serve', 1,
   '[
     {"value":"a","label":"I rarely get it in","score":1},
     {"value":"b","label":"Roughly half the time","score":2},
     {"value":"c","label":"Most of the time","score":3},
     {"value":"d","label":"Almost every time","score":4},
     {"value":"e","label":"Every time, with placement","score":5}
   ]'::jsonb),

  ('q02_return_consistency',
   'How well can you return a serve deep and to a target?',
   'return', 2,
   '[
     {"value":"a","label":"I struggle to return at all","score":1},
     {"value":"b","label":"I get it back but rarely deep","score":2},
     {"value":"c","label":"Usually deep, sometimes targeted","score":3},
     {"value":"d","label":"Consistently deep and placed","score":4},
     {"value":"e","label":"Strategic returns I can vary at will","score":5}
   ]'::jsonb),

  ('q03_dinking',
   'How comfortable are you with a sustained dinking rally at the kitchen line?',
   'dinking', 3,
   '[
     {"value":"a","label":"I avoid dinks — I pop them up","score":1},
     {"value":"b","label":"A few dinks, then I mistime","score":2},
     {"value":"c","label":"Comfortable for 4-6 shots","score":3},
     {"value":"d","label":"Comfortable for long rallies","score":4},
     {"value":"e","label":"Confident attacking out of dinks","score":5}
   ]'::jsonb),

  ('q04_volley_control',
   'When you take a ball out of the air at the kitchen, how controlled is your volley?',
   'volley', 4,
   '[
     {"value":"a","label":"It usually sails or nets","score":1},
     {"value":"b","label":"Goes in but unpredictable","score":2},
     {"value":"c","label":"Mostly in and roughly placed","score":3},
     {"value":"d","label":"Controlled angles and depths","score":4},
     {"value":"e","label":"I can punch, drop, or dink at will","score":5}
   ]'::jsonb),

  ('q05_positioning',
   'After serving and returning, do you move up to the kitchen line as a strategy?',
   'positioning', 5,
   '[
     {"value":"a","label":"No, I stay at the baseline","score":1},
     {"value":"b","label":"Sometimes, not deliberately","score":2},
     {"value":"c","label":"Usually after the third shot","score":3},
     {"value":"d","label":"Yes, with a proper third-shot drop or drive","score":4},
     {"value":"e","label":"Yes, and I control transition zone shots","score":5}
   ]'::jsonb),

  ('q06_teamwork',
   'In doubles, how often do you and your partner communicate calls and switches?',
   'teamwork', 6,
   '[
     {"value":"a","label":"We don''t talk during points","score":1},
     {"value":"b","label":"Occasionally, mostly after errors","score":2},
     {"value":"c","label":"Regular calls of mine/yours","score":3},
     {"value":"d","label":"Active stacking, switching, and shot calls","score":4},
     {"value":"e","label":"Synchronized strategy mid-rally","score":5}
   ]'::jsonb),

  ('q07_shot_selection',
   'When the ball comes to you, how often do you choose the right shot (drop/drive/dink) for the situation?',
   'shot_selection', 7,
   '[
     {"value":"a","label":"I hit whatever I can reach","score":1},
     {"value":"b","label":"I have one go-to shot regardless","score":2},
     {"value":"c","label":"I pick based on court position","score":3},
     {"value":"d","label":"I read opponent positioning and choose","score":4},
     {"value":"e","label":"I set up patterns 2-3 shots ahead","score":5}
   ]'::jsonb),

  ('q08_movement',
   'How well can you split-step and react to opponents'' shots at the kitchen?',
   'movement', 8,
   '[
     {"value":"a","label":"I''m often caught flat-footed","score":1},
     {"value":"b","label":"Slow but I usually get there","score":2},
     {"value":"c","label":"Solid split-step, decent reaction","score":3},
     {"value":"d","label":"Quick reactions, good court coverage","score":4},
     {"value":"e","label":"Anticipation-driven, rarely out of position","score":5}
   ]'::jsonb),

  ('q09_match_experience',
   'About how many matches (any format) have you played?',
   'match_experience', 9,
   '[
     {"value":"a","label":"Fewer than 5","score":1},
     {"value":"b","label":"5 to 20","score":2},
     {"value":"c","label":"20 to 100","score":3},
     {"value":"d","label":"100 to 500","score":4},
     {"value":"e","label":"500+ including tournaments","score":5}
   ]'::jsonb),

  ('q10_competitive_comfort',
   'How comfortable are you in a competitive setting (score keeping, brackets, pressure)?',
   'competitive_comfort', 10,
   '[
     {"value":"a","label":"I avoid competitive play","score":1},
     {"value":"b","label":"OK with casual scoring","score":2},
     {"value":"c","label":"Comfortable in friendly tournaments","score":3},
     {"value":"d","label":"Confident in local tournaments","score":4},
     {"value":"e","label":"Thrive under tournament pressure","score":5}
   ]'::jsonb)
ON CONFLICT (question_key) DO UPDATE
  SET question_text = EXCLUDED.question_text,
      options_json = EXCLUDED.options_json,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      active = TRUE;
