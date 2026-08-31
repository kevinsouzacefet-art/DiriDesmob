import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  ScrapMovementRequestWithDetails,
  ScrapMovementStatus,
  Material,
} from '../types'
import { materialService } from './materialService'
import { locationService } from './locationService'

export interface SupplierMaterialStockItem {
  material: Material
  qty_aguardando_classificacao: number
  qty_reaproveitavel: number
  qty_sucata: number
  qty_total_fisico: number
}

export interface SupplierStockSummary {
  material_id: string
  material_code: string
  material_name: string
  unit_area_m2: number
  aguardando_classificacao: number
  disponivel: number
  reaproveitavel: number
  sucata: number
  total_fisico: number
}

export interface ClassifyMaterialPayload {
  supplierLocationId: string
  materialId: string
  quantity: number
  destinationClassification: 'REAPROVEITAVEL' | 'SUCATA'
  notes?: string
  idempotencyKey?: string
}

export interface RequestScrapMovementPayload {
  originLocationId: string
  destinationLocationId: string
  materialId: string
  quantity: number
  notes?: string | null
  idempotencyKey?: string
}

export interface ScrapMovementFilterParams {
  originLocationId?: string
  destinationLocationId?: string
  materialId?: string
  status?: ScrapMovementStatus | string
}

export const scrapService = {
  /**
   * Fetch supplier materials categorized by stock bucket:
   * - AGUARDANDO_CLASSIFICACAO
   * - REAPROVEITAVEL (DISPONIVEL)
   * - SUCATA (SUCATA)
   * - TOTAL FISICO
   */
  async getSupplierStockSummary(supplierLocationId: string): Promise<SupplierMaterialStockItem[]> {
    if (isSupabaseConfigured) {
      // Get all balances for this location
      const { data: balances, error: balError } = await supabase
        .from('stock_balances')
        .select(`
          material_id,
          bucket,
          quantity,
          material:materials(*)
        `)
        .eq('location_id', supplierLocationId)

      if (balError) {
        console.error('Erro ao buscar saldos do fornecedor:', balError)
        throw new Error(balError.message || 'Falha ao buscar estoque do fornecedor.')
      }

      const materials = await materialService.listMaterials()
      const materialMap = new Map<string, SupplierMaterialStockItem>()

      // Initialize with materials
      materials.forEach((m) => {
        materialMap.set(m.id, {
          material: m,
          qty_aguardando_classificacao: 0,
          qty_reaproveitavel: 0,
          qty_sucata: 0,
          qty_total_fisico: 0,
        })
      })

      // Aggregate buckets
      ;(balances || []).forEach((b: any) => {
        let item = materialMap.get(b.material_id)
        if (!item && b.material) {
          item = {
            material: b.material,
            qty_aguardando_classificacao: 0,
            qty_reaproveitavel: 0,
            qty_sucata: 0,
            qty_total_fisico: 0,
          }
          materialMap.set(b.material_id, item)
        }

        if (item) {
          const qty = Number(b.quantity || 0)
          if (b.bucket === 'AGUARDANDO_CLASSIFICACAO') {
            item.qty_aguardando_classificacao += qty
          } else if (b.bucket === 'REAPROVEITAVEL' || b.bucket === 'DISPONIVEL') {
            item.qty_reaproveitavel += qty
          } else if (b.bucket === 'SUCATA') {
            item.qty_sucata += qty
          }
          item.qty_total_fisico =
            item.qty_aguardando_classificacao + item.qty_reaproveitavel + item.qty_sucata
        }
      })

      // Filter to return materials with either non-zero stock or all materials
      return Array.from(materialMap.values())
    }

    // Local Fallback simulation
    const materials = await materialService.listMaterials()
    return materials.map((m, idx) => ({
      material: m,
      qty_aguardando_classificacao: idx === 0 ? 50 : 0,
      qty_reaproveitavel: idx === 1 ? 120 : 0,
      qty_sucata: idx === 2 ? 15 : 0,
      qty_total_fisico: idx === 0 ? 50 : idx === 1 ? 120 : idx === 2 ? 15 : 0,
    }))
  },

  async getSupplierStocks(supplierLocationId: string): Promise<SupplierStockSummary[]> {
    const summaryItems = await this.getSupplierStockSummary(supplierLocationId)
    return summaryItems.map((item) => ({
      material_id: item.material.id,
      material_code: item.material.code,
      material_name: item.material.name,
      unit_area_m2: Number(item.material.unit_area_m2 || 0),
      aguardando_classificacao: item.qty_aguardando_classificacao,
      disponivel: item.qty_reaproveitavel,
      reaproveitavel: item.qty_reaproveitavel,
      sucata: item.qty_sucata,
      total_fisico: item.qty_total_fisico,
    }))
  },

  /**
   * Classify supplier material (TESTE B, C).
   * Moves quantity from AGUARDANDO_CLASSIFICACAO to either DISPONIVEL (Reaproveitável) or SUCATA.
   */
  async classifySupplierMaterial(
    locationIdOrPayload: string | ClassifyMaterialPayload,
    materialId?: string,
    quantity?: number,
    targetQuality?: 'REAPROVEITAVEL' | 'SUCATA',
    notes?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    let locId: string
    let matId: string
    let qty: number
    let quality: 'REAPROVEITAVEL' | 'SUCATA'
    let nts: string
    let key: string

    if (typeof locationIdOrPayload === 'object') {
      locId = locationIdOrPayload.supplierLocationId
      matId = locationIdOrPayload.materialId
      qty = locationIdOrPayload.quantity
      quality = locationIdOrPayload.destinationClassification
      nts = locationIdOrPayload.notes || ''
      key = locationIdOrPayload.idempotencyKey || `CLASS-${locId}-${matId}-${Date.now()}`
    } else {
      locId = locationIdOrPayload
      matId = materialId!
      qty = quantity!
      quality = targetQuality!
      nts = notes || ''
      key = idempotencyKey || `CLASS-${locId}-${matId}-${Date.now()}`
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_classify_supplier_material', {
        p_location_id: locId,
        p_material_id: matId,
        p_quantity: qty,
        p_target_quality: quality,
        p_notes: nts,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao classificar material do fornecedor:', error)
        throw new Error(error.message || 'Falha ao classificar material.')
      }

      return {
        success: true,
        message: data?.message || `Material classificado como ${quality} com sucesso.`,
      }
    }

    return {
      success: true,
      message: `Material classificado como ${quality} com sucesso (simulação).`,
    }
  },

  /**
   * Fetch scrap movement requests.
   */
  async getScrapMovementRequests(
    filters: ScrapMovementFilterParams = {}
  ): Promise<ScrapMovementRequestWithDetails[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('scrap_movement_requests')
        .select(`
          *,
          origin_location:locations!scrap_movement_requests_origin_location_id_fkey(*),
          destination_location:locations!scrap_movement_requests_destination_location_id_fkey(*),
          material:materials(*),
          requester:profiles!scrap_movement_requests_requested_by_fkey(*),
          approver:profiles!scrap_movement_requests_approved_by_fkey(*),
          rejecter:profiles!scrap_movement_requests_rejected_by_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status)
      }
      if (filters.originLocationId) {
        query = query.eq('origin_location_id', filters.originLocationId)
      }
      if (filters.destinationLocationId) {
        query = query.eq('destination_location_id', filters.destinationLocationId)
      }
      if (filters.materialId) {
        query = query.eq('material_id', filters.materialId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar solicitações de movimentação de sucata:', error)
        throw new Error(error.message || 'Falha ao buscar movimentações de sucata.')
      }

      return (data || []) as any
    }

    const materials = await materialService.listMaterials()
    const locations = await locationService.getLocations()

    return [
      {
        id: 'scrap-req-1',
        origin_location_id: locations[1]?.id || 'loc-forn',
        destination_location_id: locations[0]?.id || 'loc-galpao',
        material_id: materials[0]?.id || 'mat-1',
        quantity: 15,
        status: 'PENDENTE',
        requested_by: 'user-supplier',
        requested_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        notes: 'Solicitação de devolução de peças de sucata para descarte central.',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        origin_location: locations[1] || null,
        destination_location: locations[0] || null,
        material: materials[0] || null,
      },
    ] as any
  },

  /**
   * Request movement of scrap from supplier (TESTE D).
   * Status: PENDENTE
   */
  async requestScrapMovement(
    originLocationIdOrPayload: string | RequestScrapMovementPayload,
    destinationLocationId?: string,
    materialId?: string,
    quantity?: number,
    notes?: string | null,
    idempotencyKey?: string
  ): Promise<{ success: boolean; request_id?: string; message?: string }> {
    let origId: string
    let destId: string
    let matId: string
    let qty: number
    let nts: string
    let key: string

    if (typeof originLocationIdOrPayload === 'object') {
      origId = originLocationIdOrPayload.originLocationId
      destId = originLocationIdOrPayload.destinationLocationId
      matId = originLocationIdOrPayload.materialId
      qty = originLocationIdOrPayload.quantity
      nts = originLocationIdOrPayload.notes || ''
      key = originLocationIdOrPayload.idempotencyKey || `SCRAP-REQ-${Date.now()}`
    } else {
      origId = originLocationIdOrPayload
      destId = destinationLocationId!
      matId = materialId!
      qty = quantity!
      nts = notes || ''
      key = idempotencyKey || `SCRAP-REQ-${Date.now()}`
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_request_scrap_movement', {
        p_origin_location_id: origId,
        p_destination_location_id: destId,
        p_material_id: matId,
        p_quantity: qty,
        p_notes: nts,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao solicitar movimentação de sucata:', error)
        throw new Error(error.message || 'Falha ao solicitar movimentação de sucata.')
      }

      return {
        success: true,
        request_id: data?.request_id,
        message: 'Solicitação de movimentação de sucata criada e enviada para aprovação.',
      }
    }

    return {
      success: true,
      request_id: `scrap-sim-${Date.now()}`,
      message: 'Solicitação de movimentação de sucata criada (simulação).',
    }
  },

  /**
   * Approve and execute scrap movement (TESTE E).
   * Status: PENDENTE -> APROVADA -> EXECUTADA
   * Performs physical stock transfer between SUCATA buckets.
   */
  async approveScrapMovement(
    requestId: string,
    notes?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `SCRAP-APP-${requestId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_approve_scrap_movement', {
        p_request_id: requestId,
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao aprovar movimentação de sucata:', error)
        throw new Error(error.message || 'Falha ao aprovar movimentação de sucata.')
      }

      return {
        success: true,
        message: data?.message || 'Movimentação de sucata aprovada e executada no estoque físico.',
      }
    }

    return {
      success: true,
      message: 'Movimentação de sucata aprovada e executada (simulação).',
    }
  },

  /**
   * Reject scrap movement request (TESTE F).
   * Status: PENDENTE -> REJEITADA
   * Does NOT move any physical stock.
   */
  async rejectScrapMovement(
    requestId: string,
    notes: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `SCRAP-REJ-${requestId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_reject_scrap_movement', {
        p_request_id: requestId,
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao rejeitar movimentação de sucata:', error)
        throw new Error(error.message || 'Falha ao rejeitar movimentação de sucata.')
      }

      return {
        success: true,
        message: data?.message || 'Solicitação de movimentação de sucata rejeitada.',
      }
    }

    return {
      success: true,
      message: 'Solicitação rejeitada sem alteração de estoque (simulação).',
    }
  },
}
