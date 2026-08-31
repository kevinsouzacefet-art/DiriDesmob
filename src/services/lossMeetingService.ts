import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LossMeetingWithDetails, LossMeetingStatus } from '../types'
import { locationService } from './locationService'

export interface MeetingFilterParams {
  workId?: string
  status?: LossMeetingStatus | string
  startDate?: string
  endDate?: string
}

export interface CreateMeetingPayload {
  workId?: string | null
  meetingDate: string
  title: string
  participants?: string | null
  responsible?: string | null
  decisions?: string | null
  agreement?: string | null
  notes?: string | null
  status?: LossMeetingStatus
  lossIds?: string[]
  divergenceIds?: string[]
}

export const lossMeetingService = {
  /**
   * Fetch meetings with relations.
   */
  async getMeetings(filters: MeetingFilterParams = {}): Promise<LossMeetingWithDetails[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('loss_meetings')
        .select(`
          *,
          work:locations!loss_meetings_work_id_fkey(*),
          creator:profiles!loss_meetings_created_by_fkey(*),
          losses:loss_meeting_losses(
            *,
            loss:losses(
              *,
              material:materials(*),
              work:locations!losses_work_id_fkey(*)
            )
          ),
          divergences:loss_meeting_divergences(
            *,
            divergence:divergences(
              *,
              material:materials(*),
              load:loads(*)
            )
          )
        `)
        .order('meeting_date', { ascending: false })

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status)
      }
      if (filters.workId) {
        query = query.eq('work_id', filters.workId)
      }
      if (filters.startDate) {
        query = query.gte('meeting_date', filters.startDate)
      }
      if (filters.endDate) {
        query = query.lte('meeting_date', filters.endDate)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar atas de reuniões de perdas:', error)
        throw new Error(error.message || 'Falha ao buscar reuniões.')
      }

      return (data || []) as any
    }

    // Local Fallback simulation
    const locations = await locationService.getLocations()
    return [
      {
        id: 'meeting-mock-1',
        work_id: locations[0]?.id || 'loc-1',
        meeting_date: new Date().toISOString().split('T')[0],
        title: 'Reunião de Alinhamento de Perdas e Devoluções',
        participants: 'Eng. Roberto (Obra), Carla (Galpão), Marcos (Fornecedor)',
        responsible: 'Carla (Galpão Logística)',
        decisions: 'Definido repasse de 50% das perdas identificadas no lote #10.',
        agreement: 'Fornecedor aceitou nota de débito para compensação no próximo faturamento.',
        notes: 'Próxima reunião agendada para o fechamento do mês.',
        status: 'REALIZADA',
        created_by: 'user-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        work: locations[0] || null,
        losses: [],
        divergences: [],
      },
    ] as any
  },

  /**
   * Fetch single meeting with full junction data.
   */
  async getMeetingById(id: string): Promise<LossMeetingWithDetails | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('loss_meetings')
        .select(`
          *,
          work:locations!loss_meetings_work_id_fkey(*),
          creator:profiles!loss_meetings_created_by_fkey(*),
          losses:loss_meeting_losses(
            *,
            loss:losses(
              *,
              material:materials(*),
              work:locations!losses_work_id_fkey(*)
            )
          ),
          divergences:loss_meeting_divergences(
            *,
            divergence:divergences(
              *,
              material:materials(*),
              load:loads(*)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Erro ao buscar reunião por id:', error)
        return null
      }

      return data as any
    }

    const all = await this.getMeetings()
    return all.find((m) => m.id === id) || all[0] || null
  },

  /**
   * Create meeting and link to selected losses and divergences.
   */
  async createMeeting(
    payload: CreateMeetingPayload
  ): Promise<{ success: boolean; meeting_id?: string; message?: string }> {
    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      const { data: meeting, error: meetingError } = await supabase
        .from('loss_meetings')
        .insert({
          work_id: payload.workId || null,
          meeting_date: payload.meetingDate,
          title: payload.title,
          participants: payload.participants || null,
          responsible: payload.responsible || null,
          decisions: payload.decisions || null,
          agreement: payload.agreement || null,
          notes: payload.notes || null,
          status: payload.status || 'AGENDADA',
          created_by: userId,
        })
        .select()
        .single()

      if (meetingError) {
        console.error('Erro ao criar reunião:', meetingError)
        throw new Error(meetingError.message || 'Falha ao salvar ata de reunião.')
      }

      // Link losses if provided
      if (payload.lossIds && payload.lossIds.length > 0) {
        const lossJunctions = payload.lossIds.map((lid) => ({
          loss_meeting_id: meeting.id,
          loss_id: lid,
        }))
        await supabase.from('loss_meeting_losses').insert(lossJunctions)
      }

      // Link divergences if provided
      if (payload.divergenceIds && payload.divergenceIds.length > 0) {
        const divJunctions = payload.divergenceIds.map((did) => ({
          loss_meeting_id: meeting.id,
          divergence_id: did,
        }))
        await supabase.from('loss_meeting_divergences').insert(divJunctions)
      }

      return {
        success: true,
        meeting_id: meeting.id,
        message: 'Ata de reunião registrada com sucesso.',
      }
    }

    return {
      success: true,
      meeting_id: `meet-sim-${Date.now()}`,
      message: 'Ata de reunião registrada (simulação).',
    }
  },

  /**
   * Update meeting and junction links.
   */
  async updateMeeting(
    meetingId: string,
    payload: Partial<CreateMeetingPayload>
  ): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured) {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }
      if (payload.workId !== undefined) updateData.work_id = payload.workId
      if (payload.meetingDate) updateData.meeting_date = payload.meetingDate
      if (payload.title) updateData.title = payload.title
      if (payload.participants !== undefined) updateData.participants = payload.participants
      if (payload.responsible !== undefined) updateData.responsible = payload.responsible
      if (payload.decisions !== undefined) updateData.decisions = payload.decisions
      if (payload.agreement !== undefined) updateData.agreement = payload.agreement
      if (payload.notes !== undefined) updateData.notes = payload.notes
      if (payload.status) updateData.status = payload.status

      const { error } = await supabase.from('loss_meetings').update(updateData).eq('id', meetingId)

      if (error) {
        console.error('Erro ao atualizar ata da reunião:', error)
        throw new Error(error.message || 'Falha ao atualizar reunião.')
      }

      // Update loss links if provided
      if (payload.lossIds) {
        await supabase.from('loss_meeting_losses').delete().eq('loss_meeting_id', meetingId)
        if (payload.lossIds.length > 0) {
          const junctions = payload.lossIds.map((lid) => ({
            loss_meeting_id: meetingId,
            loss_id: lid,
          }))
          await supabase.from('loss_meeting_losses').insert(junctions)
        }
      }

      // Update divergence links if provided
      if (payload.divergenceIds) {
        await supabase.from('loss_meeting_divergences').delete().eq('loss_meeting_id', meetingId)
        if (payload.divergenceIds.length > 0) {
          const junctions = payload.divergenceIds.map((did) => ({
            loss_meeting_id: meetingId,
            divergence_id: did,
          }))
          await supabase.from('loss_meeting_divergences').insert(junctions)
        }
      }

      return { success: true, message: 'Reunião atualizada com sucesso.' }
    }

    return { success: true, message: 'Reunião atualizada (simulação).' }
  },

  /**
   * Delete meeting.
   */
  async deleteMeeting(meetingId: string): Promise<{ success: boolean }> {
    if (isSupabaseConfigured) {
      await supabase.from('loss_meeting_losses').delete().eq('loss_meeting_id', meetingId)
      await supabase.from('loss_meeting_divergences').delete().eq('loss_meeting_id', meetingId)
      const { error } = await supabase.from('loss_meetings').delete().eq('id', meetingId)
      if (error) throw new Error(error.message)
      return { success: true }
    }
    return { success: true }
  },
}
