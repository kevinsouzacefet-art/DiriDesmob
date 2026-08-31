import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  DivergenceWithDetails,
  DivergenceStatus,
  DivergenceType,
  DivergenceHistoryWithUser,
} from '../types'
import { loadService } from './loadService'
import { materialService } from './materialService'
import { conferenceService } from './conferenceService'

// In-memory fallback for local development / testing
let localDivergenceHistory: any[] = []

export interface DivergenceFilterParams {
  workId?: string
  supplierId?: string
  loadId?: string
  materialId?: string
  type?: DivergenceType | string
  status?: DivergenceStatus | string
  startDate?: string
  endDate?: string
}

export const divergenceService = {
  /**
   * Fetch all divergences with comprehensive filters and relations.
   */
  async getDivergences(filters: DivergenceFilterParams = {}): Promise<DivergenceWithDetails[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('divergences')
        .select(`
          *,
          material:materials(*),
          pallet:demobilization_pallets(*),
          load:loads(
            *,
            origin_location:locations!loads_origin_location_id_fkey(*),
            destination_location:locations!loads_destination_location_id_fkey(*)
          ),
          creator:profiles!divergences_created_by_fkey(*),
          assignee:profiles!divergences_assigned_to_fkey(*),
          resolver:profiles!divergences_resolved_by_fkey(*),
          contester:profiles!divergences_contested_by_fkey(*),
          photos:discrepancy_photos(*)
        `)
        .order('created_at', { ascending: false })

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status)
      }
      if (filters.type && filters.type !== 'ALL') {
        query = query.eq('type', filters.type)
      }
      if (filters.materialId) {
        query = query.eq('material_id', filters.materialId)
      }
      if (filters.loadId) {
        query = query.eq('load_id', filters.loadId)
      }
      if (filters.startDate) {
        query = query.gte('created_at', `${filters.startDate}T00:00:00Z`)
      }
      if (filters.endDate) {
        query = query.lte('created_at', `${filters.endDate}T23:59:59Z`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar divergências no Supabase:', error)
        throw new Error(error.message || 'Falha ao buscar divergências.')
      }

      let results: DivergenceWithDetails[] = (data || []) as any

      // Filter by origin/destination work or supplier
      if (filters.workId) {
        results = results.filter(
          (d) =>
            d.load?.origin_location_id === filters.workId ||
            d.load?.destination_location_id === filters.workId
        )
      }
      if (filters.supplierId) {
        results = results.filter(
          (d) =>
            d.load?.origin_location_id === filters.supplierId ||
            d.load?.destination_location_id === filters.supplierId
        )
      }

      return results
    }

    // Local Fallback simulation
    const loads = await loadService.getLoads()
    const materials = await materialService.listMaterials()

    // Default mock divergences if empty
    return [
      {
        id: 'div-mock-1',
        load_id: loads[0]?.id || 'load-1',
        conference_id: 'conf-1',
        pallet_conference_id: 'pconf-1',
        pallet_id: 'pal-1',
        material_id: materials[0]?.id || 'mat-1',
        type: 'FALTANTE',
        expected_qty: 50,
        received_qty: 48,
        difference_qty: 2,
        status: 'PENDENTE',
        notes: '2 peças faltantes no pallet durante a conferência física.',
        created_by: 'user-1',
        assigned_to: null,
        analysis_started_at: null,
        contest_reason: null,
        contested_by: null,
        contested_at: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        allocated_loss_qty: 0,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        material: materials[0] || null,
        load: loads[0] || null,
        photos: [],
      },
      {
        id: 'div-mock-2',
        load_id: loads[0]?.id || 'load-1',
        conference_id: 'conf-1',
        pallet_conference_id: 'pconf-1',
        pallet_id: 'pal-1',
        material_id: materials[1]?.id || 'mat-2',
        type: 'EXCEDENTE_DE_ORIGEM',
        expected_qty: 50,
        received_qty: 53,
        difference_qty: 3,
        status: 'PENDENTE',
        notes: '3 peças a mais identificadas fisicamente no descarregamento.',
        created_by: 'user-1',
        assigned_to: null,
        analysis_started_at: null,
        contest_reason: null,
        contested_by: null,
        contested_at: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        allocated_loss_qty: 0,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        material: materials[1] || null,
        load: loads[0] || null,
        photos: [],
      },
      {
        id: 'div-mock-3',
        load_id: loads[0]?.id || 'load-1',
        conference_id: 'conf-1',
        pallet_conference_id: 'pconf-1',
        pallet_id: 'pal-1',
        material_id: materials[2]?.id || 'mat-3',
        type: 'MATERIAL_DIFERENTE',
        expected_qty: 0,
        received_qty: 2,
        difference_qty: 2,
        status: 'EM_ANALISE',
        notes: 'Material recebido diferente do manifesto de expedição.',
        created_by: 'user-1',
        assigned_to: 'user-admin',
        analysis_started_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        contest_reason: null,
        contested_by: null,
        contested_at: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        allocated_loss_qty: 0,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        material: materials[2] || null,
        load: loads[0] || null,
        photos: [],
      },
    ] as any
  },

  /**
   * Fetch single divergence with full details, audit history and photos.
   */
  async getDivergenceById(id: string): Promise<DivergenceWithDetails | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('divergences')
        .select(`
          *,
          material:materials(*),
          pallet:demobilization_pallets(*),
          load:loads(
            *,
            origin_location:locations!loads_origin_location_id_fkey(*),
            destination_location:locations!loads_destination_location_id_fkey(*)
          ),
          creator:profiles!divergences_created_by_fkey(*),
          assignee:profiles!divergences_assigned_to_fkey(*),
          resolver:profiles!divergences_resolved_by_fkey(*),
          contester:profiles!divergences_contested_by_fkey(*),
          photos:discrepancy_photos(*),
          history:divergence_history(
            *,
            performer:profiles!divergence_history_performed_by_fkey(*)
          ),
          losses:losses(*)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Erro ao buscar detalhe da divergência:', error)
        return null
      }

      return data as any
    }

    const all = await this.getDivergences()
    const found = all.find((d) => d.id === id) || all[0]
    return {
      ...found,
      history: localDivergenceHistory.filter((h) => h.divergence_id === id),
    } as any
  },

  /**
   * Start administrative analysis on a divergence.
   * Status: PENDENTE -> EM_ANALISE
   */
  async startAnalysis(divergenceId: string): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      const { error } = await supabase
        .from('divergences')
        .update({
          status: 'EM_ANALISE',
          assigned_to: userId,
          analysis_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', divergenceId)

      if (error) {
        console.error('Erro ao assumir análise da divergência:', error)
        throw new Error(error.message || 'Falha ao assumir análise.')
      }

      // Record History
      await supabase.from('divergence_history').insert({
        divergence_id: divergenceId,
        action: 'DIVERGENCE_ANALYSIS_STARTED',
        from_status: 'PENDENTE',
        to_status: 'EM_ANALISE',
        notes: 'Análise assumida pelo Administrador/Analista.',
        performed_by: userId,
      })

      return { success: true, message: 'Análise da divergência iniciada com sucesso.' }
    }

    return { success: true, message: 'Análise iniciada (simulação).' }
  },

  /**
   * Contest a divergence with administrative justification.
   * Status: EM_ANALISE / PENDENTE -> CONTESTADA
   */
  async contestDivergence(
    divergenceId: string,
    reason: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('É obrigatório fornecer o motivo da contestação.')
    }

    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      const { error } = await supabase
        .from('divergences')
        .update({
          status: 'CONTESTADA',
          contest_reason: reason,
          contested_by: userId,
          contested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', divergenceId)

      if (error) {
        console.error('Erro ao contestar divergência:', error)
        throw new Error(error.message || 'Falha ao contestar divergência.')
      }

      // Record History
      await supabase.from('divergence_history').insert({
        divergence_id: divergenceId,
        action: 'DIVERGENCE_CONTESTED',
        to_status: 'CONTESTADA',
        notes: `Contestada com a justificativa: ${reason}`,
        performed_by: userId,
      })

      return { success: true, message: 'Divergência contestada com sucesso.' }
    }

    return { success: true, message: 'Divergência contestada (simulação).' }
  },

  /**
   * Reconcile found missing material physically (TESTE G).
   * Debits stock_in_transit_balances, credits destination physical stock, resolves divergence.
   */
  async resolveMissingFound(
    divergenceId: string,
    notes: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `REC-FOUND-${divergenceId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_resolve_missing_material_found', {
        p_divergence_id: divergenceId,
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao reconciliar faltante localizado:', error)
        throw new Error(error.message || 'Falha ao reconciliar faltante localizado.')
      }

      return { success: true, message: data?.message || 'Material localizado reconciliado com sucesso.' }
    }

    return {
      success: true,
      message: 'Material localizado reconciliado: trânsito baixado e estoque creditado no destino (simulação).',
    }
  },

  /**
   * Confirm physical missing material loss (TESTE H).
   * Debits/zeroes stock_in_transit_balances via BAIXA_FALTANTE without destination stock entry.
   */
  async confirmMissingLoss(
    divergenceId: string,
    notes: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `CONF-MISS-${divergenceId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_confirm_missing_material', {
        p_divergence_id: divergenceId,
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao confirmar falta física:', error)
        throw new Error(error.message || 'Falha ao confirmar falta física.')
      }

      return { success: true, message: data?.message || 'Falta física confirmada e trânsito baixado com sucesso.' }
    }

    return {
      success: true,
      message: 'Falta física confirmada: trânsito zerado via BAIXA_FALTANTE (simulação).',
    }
  },

  /**
   * Resolve excess or other administrative divergence.
   */
  async resolveExcessOrOther(
    divergenceId: string,
    resolutionType: string,
    notes: string
  ): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      const { error } = await supabase
        .from('divergences')
        .update({
          status: 'RESOLVIDA',
          resolution_type: resolutionType,
          resolution_notes: notes,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', divergenceId)

      if (error) {
        console.error('Erro ao resolver divergência:', error)
        throw new Error(error.message || 'Falha ao resolver divergência.')
      }

      await supabase.from('divergence_history').insert({
        divergence_id: divergenceId,
        action: 'DIVERGENCE_RESOLVED',
        to_status: 'RESOLVIDA',
        notes: `Resolução: ${resolutionType}. Observações: ${notes}`,
        performed_by: userId,
      })

      return { success: true, message: 'Divergência resolvida com sucesso.' }
    }

    return { success: true, message: 'Divergência resolvida (simulação).' }
  },

  /**
   * Close divergence without financial loss.
   */
  async closeWithoutLoss(divergenceId: string, notes: string): Promise<{ success: boolean; message?: string }> {
    return this.resolveExcessOrOther(divergenceId, 'ENCERRADO_SEM_PERDA', notes)
  },

  /**
   * Add manual observation / audit note to history.
   */
  async addNote(divergenceId: string, notes: string): Promise<{ success: boolean }> {
    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id

      await supabase.from('divergence_history').insert({
        divergence_id: divergenceId,
        action: 'OBSERVATION_ADDED',
        notes,
        performed_by: userId,
      })

      return { success: true }
    }

    localDivergenceHistory.push({
      id: `hist-${Date.now()}`,
      divergence_id: divergenceId,
      action: 'OBSERVATION_ADDED',
      notes,
      performed_by: 'user-admin',
      created_at: new Date().toISOString(),
    })

    return { success: true }
  },
}
