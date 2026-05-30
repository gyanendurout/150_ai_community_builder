export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          avatar_url: string | null
          home_location: Json | null
          home_court_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      courts: {
        Row: {
          id: string
          name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null
          source: string
          external_place_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['courts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['courts']['Insert']>
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'pro' | null
          dupr_rating: number | null
          app_skill_rating: number | null
          play_style: string | null
          visibility: 'public' | 'private' | 'friends' | 'friends_only' | 'event_participants'
          profile_completion_percentage: number
          display_name: string | null
          avatar_url: string | null
          dob: string | null
          age_band: 'under_18' | '18_29' | '30_39' | '40_49' | '50_59' | '60_plus' | 'prefer_not_to_say' | null
          gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'self_describe' | null
          home_court_id: string | null
          home_location_text: string | null
          home_latitude: number | null
          home_longitude: number | null
          bio: string | null
          status: 'draft' | 'active' | 'suspended' | 'deleted'
          created_from_conversation_id: string | null
          source: 'manual' | 'ai_chat' | 'import'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
        Relationships: []
      }
      player_skill_profiles: {
        Row: {
          id: string
          user_id: string
          self_rating: number | null
          dupr_rating: number | null
          dupr_id: string | null
          dupr_status: 'not_checked' | 'checking' | 'found' | 'not_found' | 'multiple' | 'error' | 'skipped'
          app_skill_rating: number | null
          skill_label: 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'expert' | null
          skill_source: 'manual' | 'dupr' | 'assessment' | 'mixed' | 'unrated'
          style_profile: string | null
          confidence_score: number | null
          category_breakdown_json: Json | null
          last_assessed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_skill_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['player_skill_profiles']['Insert']>
        Relationships: []
      }
      assessment_questions: {
        Row: {
          id: string
          question_key: string
          question_text: string
          category: 'serve' | 'return' | 'dinking' | 'volley' | 'positioning' | 'teamwork' | 'shot_selection' | 'movement' | 'match_experience' | 'competitive_comfort'
          sort_order: number
          options_json: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['assessment_questions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['assessment_questions']['Insert']>
        Relationships: []
      }
      assessment_responses: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          question_id: string
          selected_option: string
          score: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['assessment_responses']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['assessment_responses']['Insert']>
        Relationships: []
      }
      assessment_results: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          total_score: number
          app_skill_rating: number
          skill_label: 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'expert'
          category_breakdown_json: Json
          style_profile: string | null
          confidence_score: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['assessment_results']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: never
        Relationships: []
      }
      mock_dupr_ratings: {
        Row: {
          dupr_id: string
          full_name: string
          rating: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['mock_dupr_ratings']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['mock_dupr_ratings']['Insert']>
        Relationships: []
      }
      user_memory: {
        Row: {
          id: string
          user_id: string
          memory_type: string
          memory_key: string
          memory_value_json: Json
          confidence_score: number
          source: string
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_memory']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_memory']['Insert']>
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          conversation_type: 'event_creation' | 'tournament_creation' | 'profile_creation' | 'event_chat' | 'support' | 'general'
          status: 'active' | 'completed' | 'abandoned'
          current_entity_type: string | null
          current_entity_id: string | null
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
        Relationships: []
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string | null
          role: 'user' | 'assistant' | 'system' | 'tool'
          message_text: string
          message_type: 'text' | 'tool_call' | 'tool_result' | 'system'
          metadata_json: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversation_messages']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['conversation_messages']['Insert']>
        Relationships: []
      }
      ai_runs: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          model_provider: string
          model_name: string
          input_tokens: number | null
          output_tokens: number | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          error_message: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_runs']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ai_runs']['Insert']>
        Relationships: []
      }
      ai_tool_calls: {
        Row: {
          id: string
          ai_run_id: string
          tool_name: string
          input_json: Json | null
          output_json: Json | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          requires_approval: boolean
          approved_by_user: boolean | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_tool_calls']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ai_tool_calls']['Insert']>
        Relationships: []
      }
      drafts: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          entity_type: 'event' | 'tournament' | 'profile' | 'invite_message'
          entity_id: string | null
          draft_json: Json
          status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'committed'
          completion_percentage: number
          missing_fields_json: Json
          ai_summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['drafts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['drafts']['Insert']>
        Relationships: []
      }
      approvals: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          action_type: 'create_event' | 'send_invites' | 'publish_tournament' | 'save_profile' | 'send_message' | 'process_refund'
          action_payload_json: Json
          status: 'pending' | 'approved' | 'rejected' | 'expired'
          approved_at: string | null
          rejected_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['approvals']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>
        Relationships: []
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          event_type: 'singles' | 'doubles' | 'mixed_doubles' | 'open_play' | 'drill' | 'tournament' | null
          sport_type: string
          start_at: string
          end_at: string | null
          timezone: string
          court_id: string | null
          location_name: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          player_capacity: number
          visibility: 'public' | 'private' | 'invite_only'
          status: 'draft' | 'published' | 'cancelled' | 'completed'
          source: 'ai_chat' | 'manual' | 'import'
          created_from_conversation_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
        Relationships: []
      }
      event_participants: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: 'invited' | 'accepted' | 'declined' | 'waitlisted' | 'cancelled' | 'attended'
          invited_by: string | null
          joined_at: string | null
          cancelled_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['event_participants']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['event_participants']['Insert']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          before_json: Json | null
          after_json: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: never
        Relationships: []
      }
      feature_flags: {
        Row: {
          id: string
          flag_key: string
          enabled: boolean
          description: string | null
          rollout_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['feature_flags']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['feature_flags']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

// Convenience row type aliases
export type UserRow = Database['public']['Tables']['users']['Row']
export type CourtRow = Database['public']['Tables']['courts']['Row']
export type EventRow = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']
export type ConversationRow = Database['public']['Tables']['conversations']['Row']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type MessageRow = Database['public']['Tables']['conversation_messages']['Row']
export type MessageInsert = Database['public']['Tables']['conversation_messages']['Insert']
export type DraftRow = Database['public']['Tables']['drafts']['Row']
export type DraftInsert = Database['public']['Tables']['drafts']['Insert']
export type ApprovalRow = Database['public']['Tables']['approvals']['Row']
export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert']
export type AiRunInsert = Database['public']['Tables']['ai_runs']['Insert']
export type AiToolCallInsert = Database['public']['Tables']['ai_tool_calls']['Insert']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
export type FeatureFlagRow = Database['public']['Tables']['feature_flags']['Row']
export type UserMemoryRow = Database['public']['Tables']['user_memory']['Row']
export type UserMemoryInsert = Database['public']['Tables']['user_memory']['Insert']

// Player profile flow (added in migration 00003)
export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
export type PlayerSkillProfileRow = Database['public']['Tables']['player_skill_profiles']['Row']
export type PlayerSkillProfileInsert = Database['public']['Tables']['player_skill_profiles']['Insert']
export type PlayerSkillProfileUpdate = Database['public']['Tables']['player_skill_profiles']['Update']
export type AssessmentQuestionRow = Database['public']['Tables']['assessment_questions']['Row']
export type AssessmentResponseRow = Database['public']['Tables']['assessment_responses']['Row']
export type AssessmentResponseInsert = Database['public']['Tables']['assessment_responses']['Insert']
export type AssessmentResultRow = Database['public']['Tables']['assessment_results']['Row']
export type AssessmentResultInsert = Database['public']['Tables']['assessment_results']['Insert']
export type MockDuprRatingRow = Database['public']['Tables']['mock_dupr_ratings']['Row']
