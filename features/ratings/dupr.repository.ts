import { createServiceClient } from '@/lib/supabase/server'
import type { MockDuprRatingRow } from '@/lib/supabase/types'

export class DuprRepository {
  private client = createServiceClient()

  async findById(duprId: string): Promise<MockDuprRatingRow | null> {
    const { data, error } = await this.client
      .from('mock_dupr_ratings')
      .select('*')
      .eq('dupr_id', duprId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  // Case-insensitive contains match on full_name. Caps at 5 results so a
  // permissive query like "a" cannot dump the whole table to the AI.
  async findByName(name: string): Promise<MockDuprRatingRow[]> {
    const trimmed = name.trim()
    if (!trimmed) return []
    const { data, error } = await this.client
      .from('mock_dupr_ratings')
      .select('*')
      .ilike('full_name', `%${trimmed}%`)
      .limit(5)
    if (error) throw new Error(error.message)
    return data ?? []
  }
}
