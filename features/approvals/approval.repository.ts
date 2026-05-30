import { createServiceClient } from '@/lib/supabase/server'
import type { ApprovalInsert, ApprovalRow } from '@/lib/supabase/types'

export class ApprovalRepository {
  private client = createServiceClient()

  async insert(data: ApprovalInsert): Promise<ApprovalRow> {
    const { data: row, error } = await this.client
      .from('approvals')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async update(id: string, data: Partial<ApprovalInsert>): Promise<ApprovalRow> {
    // The approvals table trigger fires on UPDATE but the table has no updated_at column,
    // causing a Postgres error. Work around it with a delete + re-insert preserving the id.
    const { data: existing, error: findError } = await this.client
      .from('approvals')
      .select('*')
      .eq('id', id)
      .single()
    if (findError || !existing) throw new Error(findError?.message ?? 'Approval not found')

    await this.client.from('approvals').delete().eq('id', id)

    const merged: ApprovalInsert = {
      id: existing.id,
      user_id: existing.user_id,
      conversation_id: existing.conversation_id,
      action_type: existing.action_type,
      action_payload_json: existing.action_payload_json,
      status: data.status ?? existing.status,
      approved_at: data.approved_at ?? existing.approved_at,
      rejected_at: data.rejected_at ?? existing.rejected_at,
    }

    const { data: row, error } = await this.client
      .from('approvals')
      .insert(merged)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async findById(id: string): Promise<ApprovalRow | null> {
    const { data, error } = await this.client
      .from('approvals')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
}
