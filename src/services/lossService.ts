import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  LossWithDetails,
  LossStatus,
  LossResponsibleType,
  Loss,
} from '../types'
import { materialService } from './materialService'
import { locationService } from './locationService'

export interface LossFilterParams {
  workId?: string
  supplierId?: string
  materialId?: string
  responsibleType?: LossResponsibleType | string
  status?: LossStatus | string
  startDate?: string
  endDate?: string
}

export interface CreateLossPayload {
  divergenceId?: string | null
  workId?: string | null
  supplierId?: string | null
  materialId: string
  quantity: number
  responsibleType: LossResponsibleType
  responsibleReferenceId?: string | null
  reason: string
  chargedValue?: number | null
  agreementNotes?: string | null
}

export const lossService = {
  /**
   * Fetch all losses with relationships and filters.
   */
  async getLosses(filters: LossFilterParams = {}): Promise<LossWithDetails[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('losses')
        .select(`
          *,
          material:materials(*),
          work:locations!losses_work_id_fkey(*),
          supplier:locations!losses_supplier_id_fkey(*),
          responsible_location:locations!losses_responsible_reference_id_fkey(*),
          creator:profiles!losses_created_by_fkey(*),
          divergence:divergences(
            *,
            load:loads(
              *,
              origin_location:locations!loads_origin_location_id_fkey(*),
              destination_location:locations!loads_destination_location_id_fkey(*)
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status)
      }
      if (filters.responsibleType && filters.responsibleType !== 'ALL') {
        query = query.eq('responsible_type', filters.responsibleType)
      }
      if (filters.workId) {
        query = query.eq('work_id', filters.workId)
      }
      if (filters.supplierId) {
        query = query.eq('supplier_id', filters.supplierId)
      }
      if (filters.materialId) {
        query = query.eq('material_id', filters.materialId)
      }
      if (filters.startDate) {
        query = query.gte('created_at', `${filters.startDate}T00:00:00Z`)
      }
      if (filters.endDate) {
        query = query.lte('created_at', `${filters.endDate}T23:59:59Z`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar perdas financeiras:', error)
        throw new Error(error.message || 'Falha ao buscar perdas.')
      }

      return (data || []) as any
    }

    // Local Fallback simulation
    const materials = await materialService.listMaterials()
    const locations = await locationService.getLocations()

    return [
      {
        id: 'loss-mock-1',
        divergence_id: 'div-mock-1',
        work_id: locations[0]?.id || 'loc-1',
        supplier_id: locations[1]?.id || 'loc-2',
        material_id: materials[0]?.id || 'mat-1',
        quantity: 2,
        responsible_type: 'OBRA',
        responsible_reference_id: locations[0]?.id || 'loc-1',
        reason: 'Faltante apurado na conferência de retorno da obra.',
        status: 'PENDENTE',
        applied_rate_per_m2: 45.0,
        unit_area_m2_snapshot: 1.25,
        calculated_value: 112.5, // 2 * 1.25 * 45
        charged_value: null,
        agreement_notes: null,
        created_by: 'user-admin',
        created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        material: materials[0] || null,
        work: locations[0] || null,
        supplier: locations[1] || null,
        responsible_location: locations[0] || null,
      },
    ] as any
  },

  /**
   * Fetch single loss by ID.
   */
  async getLossById(id: string): Promise<LossWithDetails | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('losses')
        .select(`
          *,
          material:materials(*),
          work:locations!losses_work_id_fkey(*),
          supplier:locations!losses_supplier_id_fkey(*),
          responsible_location:locations!losses_responsible_reference_id_fkey(*),
          creator:profiles!losses_created_by_fkey(*),
          divergence:divergences(
            *,
            load:loads(
              *,
              origin_location:locations!loads_origin_location_id_fkey(*),
              destination_location:locations!loads_destination_location_id_fkey(*)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Erro ao buscar perda por id:', error)
        return null
      }

      return data as any
    }

    const all = await this.getLosses()
    return all.find((l) => l.id === id) || all[0] || null
  },

  /**
   * Query effective loss rate for material, work and date.
   */
  async getLossRate(
    materialId: string,
    workId?: string | null,
    targetDate?: string
  ): Promise<number | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_get_loss_rate_for_material_and_work', {
        p_material_id: materialId,
        p_work_id: workId || null,
        p_target_date: targetDate || new Date().toISOString().split('T')[0],
      })

      if (error) {
        console.error('Erro ao consultar tabela de perdas:', error)
        return null
      }

      return data ? Number(data) : null
    }

    return 45.0 // fallback
  },

  /**
   * Create financial loss via transactional RPC (TESTE K, L, M, N).
   * Validates mandatory active rate, prevents double-counting against divergence.
   */
  async createLoss(
    payload: CreateLossPayload,
    idempotencyKey?: string
  ): Promise<{ success: boolean; loss_id?: string; message?: string }> {
    const key = idempotencyKey || `LOSS-NEW-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_create_loss', {
        p_divergence_id: payload.divergenceId || null,
        p_work_id: payload.workId || null,
        p_supplier_id: payload.supplierId || null,
        p_material_id: payload.materialId,
        p_quantity: payload.quantity,
        p_responsible_type: payload.responsibleType,
        p_responsible_reference_id: payload.responsibleReferenceId || null,
        p_reason: payload.reason,
        p_charged_value: payload.chargedValue || null,
        p_agreement_notes: payload.agreementNotes || null,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao criar perda financeira:', error)
        throw new Error(error.message || 'Falha ao registrar perda financeira.')
      }

      return {
        success: true,
        loss_id: data?.loss_id,
        message: 'Perda financeira registrada com sucesso.',
      }
    }

    return {
      success: true,
      loss_id: `loss-sim-${Date.now()}`,
      message: 'Perda financeira registrada com sucesso (simulação).',
    }
  },

  /**
   * Update loss status, charged value, and agreement notes.
   */
  async updateLossStatus(
    lossId: string,
    status: LossStatus,
    chargedValue?: number | null,
    agreementNotes?: string | null
  ): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured) {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (chargedValue !== undefined) updates.charged_value = chargedValue
      if (agreementNotes !== undefined) updates.agreement_notes = agreementNotes

      const { error } = await supabase.from('losses').update(updates).eq('id', lossId)

      if (error) {
        console.error('Erro ao atualizar status da perda:', error)
        throw new Error(error.message || 'Falha ao atualizar perda.')
      }

      return { success: true, message: 'Status da perda atualizado com sucesso.' }
    }

    return { success: true, message: 'Status da perda atualizado (simulação).' }
  },
}
