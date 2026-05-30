import { createServiceClient } from '@/lib/supabase/server'
import type {
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  PlayerSkillProfileRow,
  PlayerSkillProfileInsert,
  PlayerSkillProfileUpdate,
} from '@/lib/supabase/types'

export class ProfileRepository {
  private client = createServiceClient()

  // ─── user_profiles ─────────────────────────────────────────────────────
  async findByUserId(userId: string): Promise<UserProfileRow | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  async findAll(): Promise<UserProfileRow[]> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Used by the public detail page which gets the profile id from the URL.
  async findById(id: string): Promise<UserProfileRow | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  // Upsert because user_profiles.user_id is UNIQUE — re-running the save
  // path should update, not duplicate.
  async upsertProfile(data: UserProfileInsert): Promise<UserProfileRow> {
    const { data: row, error } = await this.client
      .from('user_profiles')
      .upsert(data, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async updateProfile(id: string, data: UserProfileUpdate): Promise<UserProfileRow> {
    const { data: row, error } = await this.client
      .from('user_profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  // ─── player_skill_profiles ─────────────────────────────────────────────
  async findSkillByUserId(userId: string): Promise<PlayerSkillProfileRow | null> {
    const { data, error } = await this.client
      .from('player_skill_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  async upsertSkill(data: PlayerSkillProfileInsert): Promise<PlayerSkillProfileRow> {
    const { data: row, error } = await this.client
      .from('player_skill_profiles')
      .upsert(data, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async updateSkill(id: string, data: PlayerSkillProfileUpdate): Promise<PlayerSkillProfileRow> {
    const { data: row, error } = await this.client
      .from('player_skill_profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }
}
