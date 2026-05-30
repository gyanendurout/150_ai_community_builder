import { createServiceClient } from '@/lib/supabase/server'
import type { CourtRow } from '@/lib/supabase/types'

export class CourtRepository {
  private client = createServiceClient()

  async findAll(): Promise<CourtRow[]> {
    const { data, error } = await this.client
      .from('courts')
      .select('*')
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findById(id: string): Promise<CourtRow | null> {
    const { data, error } = await this.client
      .from('courts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
}
