-- ============================================================================
-- 00003_profile_creation_schema.sql
-- ----------------------------------------------------------------------------
-- Foundation for the AI-Powered Player Profile Creation flow (Phase 1 of the
-- PRP for `ai-player-profile-creation`).
--
-- All changes are ADDITIVE:
--   • Extends `user_profiles` with new columns (every column NULLable so
--     existing rows remain valid)
--   • Creates 4 new tables: player_skill_profiles, assessment_questions,
--     assessment_responses, assessment_results
--   • Creates a mock_dupr_ratings table for the POC DUPR stub
--
-- It does NOT:
--   • touch any event_creation table
--   • change any column type or constraint on existing data
--   • alter conversations.conversation_type (already includes 'profile_creation')
--   • alter drafts.entity_type (already includes 'profile')
--   • alter approvals.action_type (already includes 'save_profile')
-- ============================================================================

-- ─── 1. EXTEND user_profiles ────────────────────────────────────────────────
-- Existing columns kept untouched: id, user_id, skill_level, dupr_rating,
-- app_skill_rating, play_style, visibility, profile_completion_percentage,
-- created_at, updated_at. (skill_level / dupr_rating / app_skill_rating live
-- here historically; new skill source data lives in player_skill_profiles.)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS age_band TEXT
    CHECK (age_band IS NULL OR age_band IN (
      'under_18','18_29','30_39','40_49','50_59','60_plus','prefer_not_to_say'
    )),
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IS NULL OR gender IN (
      'male','female','non_binary','prefer_not_to_say','self_describe'
    )),
  ADD COLUMN IF NOT EXISTS home_court_id UUID REFERENCES courts(id),
  ADD COLUMN IF NOT EXISTS home_location_text TEXT,
  ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','suspended','deleted')),
  ADD COLUMN IF NOT EXISTS created_from_conversation_id UUID REFERENCES conversations(id),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','ai_chat','import'));

-- Widen visibility to the 4-value set the PRD requires. Existing values
-- ('public','private','friends') stay valid; add 'event_participants' and
-- 'friends_only' as the canonical names. We DROP the old constraint and
-- recreate so 'friends' is grandfathered in as an alias of 'friends_only'.
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_visibility_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_visibility_check
  CHECK (visibility IN ('public','private','friends','friends_only','event_participants'));

-- ─── 2. PLAYER_SKILL_PROFILES ───────────────────────────────────────────────
-- Separate from user_profiles because skill is multi-source (DUPR + assessment +
-- self) and changes on a different cadence (assessment retakes, DUPR sync).
CREATE TABLE IF NOT EXISTS player_skill_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  self_rating DECIMAL(3,1)
    CHECK (self_rating IS NULL OR (self_rating >= 1.0 AND self_rating <= 5.0)),
  dupr_rating DECIMAL(4,2)
    CHECK (dupr_rating IS NULL OR (dupr_rating >= 2.0 AND dupr_rating <= 8.0)),
  dupr_id TEXT,
  dupr_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (dupr_status IN ('not_checked','checking','found','not_found','multiple','error','skipped')),
  app_skill_rating DECIMAL(3,1)
    CHECK (app_skill_rating IS NULL OR (app_skill_rating >= 1.0 AND app_skill_rating <= 5.0)),
  skill_label TEXT
    CHECK (skill_label IS NULL OR skill_label IN ('beginner','developing','intermediate','advanced','expert')),
  -- Canonical source the UI shows as the user's effective skill.
  skill_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (skill_source IN ('manual','dupr','assessment','mixed','unrated')),
  style_profile TEXT,
  confidence_score DECIMAL(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  category_breakdown_json JSONB,
  last_assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── 3. ASSESSMENT_QUESTIONS ────────────────────────────────────────────────
-- Seeded from supabase/seed.sql. Read-only at runtime for the POC.
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_key TEXT NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'serve','return','dinking','volley','positioning','teamwork',
    'shot_selection','movement','match_experience','competitive_comfort'
  )),
  sort_order INTEGER NOT NULL,
  -- options_json shape: [{ value: 'a', label: '...', score: 1 }, ...]
  options_json JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. ASSESSMENT_RESPONSES ────────────────────────────────────────────────
-- One row per (user, conversation, question). Replayable — UPDATE on retake.
CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  question_id UUID NOT NULL REFERENCES assessment_questions(id),
  selected_option TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, conversation_id, question_id)
);

-- ─── 5. ASSESSMENT_RESULTS ──────────────────────────────────────────────────
-- One row per completed assessment run. History is preserved (no UPDATE).
CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  total_score INTEGER NOT NULL,
  app_skill_rating DECIMAL(3,1) NOT NULL
    CHECK (app_skill_rating >= 1.0 AND app_skill_rating <= 5.0),
  skill_label TEXT NOT NULL
    CHECK (skill_label IN ('beginner','developing','intermediate','advanced','expert')),
  -- Map of category → average score for the breakdown UI.
  category_breakdown_json JSONB NOT NULL DEFAULT '{}',
  style_profile TEXT,
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 1.0
    CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. MOCK_DUPR_RATINGS (POC ONLY) ────────────────────────────────────────
-- Seed-only table used by the DUPR service stub. Production swap replaces the
-- service implementation with a real API call; this table is then orphaned.
CREATE TABLE IF NOT EXISTS mock_dupr_ratings (
  dupr_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  rating DECIMAL(4,2) NOT NULL CHECK (rating >= 2.0 AND rating <= 8.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_player_skill_profiles_user_id ON player_skill_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_sort ON assessment_questions(sort_order) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user ON assessment_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_convo ON assessment_responses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_home_court ON user_profiles(home_court_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);

-- ─── UPDATED_AT TRIGGERS ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_player_skill_profiles_updated_at ON player_skill_profiles;
CREATE TRIGGER trg_player_skill_profiles_updated_at
  BEFORE UPDATE ON player_skill_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_questions_updated_at ON assessment_questions;
CREATE TRIGGER trg_assessment_questions_updated_at
  BEFORE UPDATE ON assessment_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
ALTER TABLE player_skill_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_dupr_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read the assessment question bank (it's not sensitive).
DROP POLICY IF EXISTS "assessment_questions_public_read" ON assessment_questions;
CREATE POLICY "assessment_questions_public_read" ON assessment_questions FOR SELECT USING (active = TRUE);

-- Service role bypasses RLS automatically for all server-side writes.
