import { createServiceClient } from '@/lib/supabase/server'
import type { EventInsert, EventRow, EventUpdate } from '@/lib/supabase/types'

export class EventRepository {
  private client = createServiceClient()

  async insert(data: EventInsert): Promise<EventRow> {
    const { data: row, error } = await this.client
      .from('events')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }

  async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  async findByOrganizer(organizerId: string): Promise<EventRow[]> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('start_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findAll(): Promise<EventRow[]> {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .order('start_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async update(id: string, data: EventUpdate): Promise<EventRow> {
    const { data: row, error } = await this.client
      .from('events')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return row
  }
}
