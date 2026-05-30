import { createServiceClient } from '@/lib/supabase/server'
import type { DraftInsert, DraftRow } from '@/lib/supabase/types'

export class DraftRepository {
  private client = createServiceClient()

  async insert(data: DraftInsert): Promise<DraftRow> {
    const { data: row, error } = await this.client
      .from('drafts')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async update(id: string, data: Partial<DraftInsert>): Promise<DraftRow> {
    const { data: row, error } = await this.client
      .from('drafts')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async findById(id: string): Promise<DraftRow | null> {
    const { data, error } = await this.client
      .from('drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  async findByConversation(conversationId: string): Promise<DraftRow | null> {
    const { data, error } = await this.client
      .from('drafts')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('entity_type', 'event')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
}
