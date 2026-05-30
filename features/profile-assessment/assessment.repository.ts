import { createServiceClient } from '@/lib/supabase/server'
import type {
  AssessmentQuestionRow,
  AssessmentResponseInsert,
  AssessmentResponseRow,
  AssessmentResultInsert,
  AssessmentResultRow,
} from '@/lib/supabase/types'

export class AssessmentRepository {
  private client = createServiceClient()

  async listActiveQuestions(): Promise<AssessmentQuestionRow[]> {
    const { data, error } = await this.client
      .from('assessment_questions')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findQuestionsByIds(ids: string[]): Promise<AssessmentQuestionRow[]> {
    if (ids.length === 0) return []
    const { data, error } = await this.client
      .from('assessment_questions')
      .select('*')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Upsert so re-answering a question (e.g. the user navigates back) overwrites
  // the previous response instead of creating a duplicate. The UNIQUE
  // (user_id, conversation_id, question_id) constraint requires non-null
  // conversation_id; we synthesize one if the row is intended as a draft.
  async upsertResponse(data: AssessmentResponseInsert): Promise<AssessmentResponseRow> {
    const { data: row, error } = await this.client
      .from('assessment_responses')
      .upsert(data, { onConflict: 'user_id,conversation_id,question_id' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async insertResult(data: AssessmentResultInsert): Promise<AssessmentResultRow> {
    const { data: row, error } = await this.client
      .from('assessment_results')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async findLatestResult(userId: string): Promise<AssessmentResultRow | null> {
    const { data, error } = await this.client
      .from('assessment_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
}
