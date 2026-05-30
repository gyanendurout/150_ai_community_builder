import { createServiceClient } from '@/lib/supabase/server'
import type { UserMemoryRow, UserMemoryInsert } from '@/lib/supabase/types'

export class MemoryRepository {
  private client = createServiceClient()

  async findByUser(userId: string): Promise<UserMemoryRow[]> {
    const { data, error } = await this.client
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('confidence_score', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findByUserAndKeys(userId: string, keys: string[]): Promise<UserMemoryRow[]> {
    const { data, error } = await this.client
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .in('memory_key', keys)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async upsert(data: UserMemoryInsert): Promise<UserMemoryRow> {
    const { data: row, error } = await this.client
      .from('user_memory')
      .upsert(data, { onConflict: 'user_id,memory_key' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }
}
