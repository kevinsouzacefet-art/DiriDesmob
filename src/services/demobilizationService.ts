import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  Demobilization,
  DemobilizationWithRelations,
  DemobilizationPallet,
  DemobilizationPalletWithDetails,
  DemobilizationPalletItem,
  DemobilizationPalletItemWithMaterial,
  StockBalanceWithDetails,
  Location,
  Material,
} from '../types'
import { locationService } from './locationService'
import { materialService } from './materialService'

// In-memory fallback stores for offline/local simulation
let localDemobilizations: Demobilization[] = []
let localPallets: DemobilizationPallet[] = []
let localPalletItems: DemobilizationPalletItem[] = []

export const demobilizationService = {
  /**
   * List all demobilizations with aggregate metrics
   */
  async getDemobilizations(filters?: {
    workId?: string
    status?: string
    targetLocationId?: string
  }): Promise<DemobilizationWithRelations[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('demobilizations')
        .select(`
          *,
          work:locations!demobilizations_work_id_fkey(*),
          target_location:locations!demobilizations_target_location_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (filters?.workId && filters.workId !== 'all') {
        query = query.eq('work_id', filters.workId)
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.targetLocationId && filters.targetLocationId !== 'all') {
        query = query.eq('target_location_id', filters.targetLocationId)
      }

      const { data: demobs, error } = await query

      if (error) {
        console.error('Erro ao buscar desmobilizações:', error)
        return this.getLocalDemobilizations(filters)
      }

      // Enrich each demobilization with stock balances and pallets count
      const enrichedList: DemobilizationWithRelations[] = await Promise.all(
        (demobs || []).map(async (d: any) => {
          // 1. Fetch Pallet metrics
          const { data: pallets } = await supabase
            .from('demobilization_pallets')
            .select('id, status')
            .eq('demobilization_id', d.id)

          const allPallets = pallets || []
          const pallets_count = allPallets.filter((p) => p.status !== 'DESMONTADO' && p.status !== 'CANCELADO').length
          const pallets_in_assembly = allPallets.filter((p) => p.status === 'EM_MONTAGEM').length
          const pallets_ready = allPallets.filter((p) => p.status === 'PRONTO').length

          // 2. Fetch Stock Balances at this work
          const { data: balances } = await supabase
            .from('stock_balances')
            .select(`quantity, bucket, material:materials(unit_area_m2)`)
            .eq('location_id', d.work_id)

          let available_pieces = 0
          let reserved_pieces = 0
          let reserved_area_m2 = 0

          ;(balances || []).forEach((b: any) => {
            if (b.bucket === 'DISPONIVEL') {
              available_pieces += Number(b.quantity || 0)
            } else if (b.bucket === 'RESERVADO') {
              const qty = Number(b.quantity || 0)
              reserved_pieces += qty
              const area = Number(b.material?.unit_area_m2 || 0)
              reserved_area_m2 += qty * area
            }
          })

          // 3. Last movement date
          const { data: lastMv } = await supabase
            .from('stock_movements')
            .select('created_at')
            .eq('demobilization_id', d.id)
            .order('created_at', { ascending: false })
            .limit(1)

          return {
            ...d,
            pallets_count,
            pallets_in_assembly,
            pallets_ready,
            available_pieces,
            reserved_pieces,
            reserved_area_m2: Number(reserved_area_m2.toFixed(2)),
            last_movement_at: lastMv?.[0]?.created_at || d.updated_at,
          }
        })
      )

      return enrichedList
    }

    return this.getLocalDemobilizations(filters)
  },

  /**
   * Get single demobilization by ID with full details
   */
  async getDemobilizationById(id: string): Promise<DemobilizationWithRelations | null> {
    if (isSupabaseConfigured) {
      const { data: d, error } = await supabase
        .from('demobilizations')
        .select(`
          *,
          work:locations!demobilizations_work_id_fkey(*),
          target_location:locations!demobilizations_target_location_id_fkey(*)
        `)
        .eq('id', id)
        .single()

      if (error || !d) {
        console.error('Erro ao buscar desmobilização por ID:', error)
        return null
      }

      // Fetch pallet statistics
      const { data: pallets } = await supabase
        .from('demobilization_pallets')
        .select('id, status')
        .eq('demobilization_id', d.id)

      const allPallets = pallets || []
      const pallets_count = allPallets.filter((p) => p.status !== 'DESMONTADO' && p.status !== 'CANCELADO').length
      const pallets_in_assembly = allPallets.filter((p) => p.status === 'EM_MONTAGEM').length
      const pallets_ready = allPallets.filter((p) => p.status === 'PRONTO').length

      // Fetch Stock Balances
      const { data: balances } = await supabase
        .from('stock_balances')
        .select(`quantity, bucket, material:materials(unit_area_m2)`)
        .eq('location_id', d.work_id)

      let available_pieces = 0
      let reserved_pieces = 0
      let reserved_area_m2 = 0

      ;(balances || []).forEach((b: any) => {
        if (b.bucket === 'DISPONIVEL') {
          available_pieces += Number(b.quantity || 0)
        } else if (b.bucket === 'RESERVADO') {
          const qty = Number(b.quantity || 0)
          reserved_pieces += qty
          const area = Number(b.material?.unit_area_m2 || 0)
          reserved_area_m2 += qty * area
        }
      })

      return {
        ...d,
        pallets_count,
        pallets_in_assembly,
        pallets_ready,
        available_pieces,
        reserved_pieces,
        reserved_area_m2: Number(reserved_area_m2.toFixed(2)),
      }
    }

    return null
  },

  /**
   * Enable a work for demobilization (Admin only RPC)
   */
  async enableDemobilization(
    workId: string,
    targetLocationId?: string | null,
    notes?: string
  ): Promise<{ success: boolean; demobilization_id?: string; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_enable_work_demobilization', {
        p_work_id: workId,
        p_target_location_id: targetLocationId || null,
        p_notes: notes || null,
      })

      if (error) {
        console.error('Erro na RPC fn_enable_work_demobilization:', error)
        return { success: false, error: error.message }
      }

      return { success: true, demobilization_id: (data as any)?.demobilization_id }
    }

    return { success: true, demobilization_id: 'mock-demob-id' }
  },

  /**
   * Update planned target location for a demobilization
   */
  async updateDemobilizationTarget(
    demobilizationId: string,
    targetLocationId: string | null,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_update_demobilization_target', {
        p_demobilization_id: demobilizationId,
        p_target_location_id: targetLocationId,
        p_notes: notes || null,
      })

      if (error) {
        console.error('Erro na RPC fn_update_demobilization_target:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    }

    return { success: true }
  },

  /**
   * Get all pallets belonging to a demobilization with their items & totals
   */
  async getDemobilizationPallets(demobilizationId: string): Promise<DemobilizationPalletWithDetails[]> {
    if (isSupabaseConfigured) {
      const { data: pallets, error } = await supabase
        .from('demobilization_pallets')
        .select(`
          *,
          origin_location:locations!demobilization_pallets_origin_location_id_fkey(*),
          destination_location:locations!demobilization_pallets_destination_location_id_fkey(*),
          creator:profiles!demobilization_pallets_created_by_fkey(*)
        `)
        .eq('demobilization_id', demobilizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar pallets:', error)
        return []
      }

      // Fetch items for each pallet
      const palletsWithItems: DemobilizationPalletWithDetails[] = await Promise.all(
        (pallets || []).map(async (p: any) => {
          const { data: items } = await supabase
            .from('demobilization_pallet_items')
            .select(`
              *,
              material:materials(*)
            `)
            .eq('pallet_id', p.id)

          let total_pieces = 0
          let total_area_m2 = 0

          const itemsWithArea: DemobilizationPalletItemWithMaterial[] = (items || []).map((it: any) => {
            const qty = Number(it.quantity || 0)
            const unitArea = Number(it.material?.unit_area_m2 || 0)
            const itemArea = Number((qty * unitArea).toFixed(4))
            total_pieces += qty
            total_area_m2 += itemArea

            return {
              ...it,
              total_area_m2: itemArea,
            }
          })

          return {
            ...p,
            items: itemsWithArea,
            total_pieces,
            total_area_m2: Number(total_area_m2.toFixed(2)),
          }
        })
      )

      return palletsWithItems
    }

    return []
  },

  /**
   * Get single pallet by ID with all item details and work available balances
   */
  async getPalletById(palletId: string): Promise<DemobilizationPalletWithDetails | null> {
    if (isSupabaseConfigured) {
      const { data: p, error } = await supabase
        .from('demobilization_pallets')
        .select(`
          *,
          origin_location:locations!demobilization_pallets_origin_location_id_fkey(*),
          destination_location:locations!demobilization_pallets_destination_location_id_fkey(*),
          demobilization:demobilizations!demobilization_pallets_demobilization_id_fkey(*),
          creator:profiles!demobilization_pallets_created_by_fkey(*)
        `)
        .eq('id', palletId)
        .single()

      if (error || !p) {
        console.error('Erro ao buscar pallet por ID:', error)
        return null
      }

      // Fetch pallet items
      const { data: items } = await supabase
        .from('demobilization_pallet_items')
        .select(`
          *,
          material:materials(*)
        `)
        .eq('pallet_id', p.id)

      // Fetch work stock balances for items in the pallet
      const { data: balances } = await supabase
        .from('stock_balances')
        .select('material_id, bucket, quantity')
        .eq('location_id', p.origin_location_id)
        .eq('bucket', 'DISPONIVEL')

      const balanceMap = new Map<string, number>()
      ;(balances || []).forEach((b: any) => {
        balanceMap.set(b.material_id, Number(b.quantity || 0))
      })

      let total_pieces = 0
      let total_area_m2 = 0

      const itemsWithDetails: DemobilizationPalletItemWithMaterial[] = (items || []).map((it: any) => {
        const qty = Number(it.quantity || 0)
        const unitArea = Number(it.material?.unit_area_m2 || 0)
        const itemArea = Number((qty * unitArea).toFixed(4))
        total_pieces += qty
        total_area_m2 += itemArea

        return {
          ...it,
          total_area_m2: itemArea,
          available_at_work: balanceMap.get(it.material_id) || 0,
        }
      })

      return {
        ...p,
        items: itemsWithDetails,
        total_pieces,
        total_area_m2: Number(total_area_m2.toFixed(2)),
      }
    }

    return null
  },

  /**
   * Create a new demobilization pallet
   */
  async createPallet(
    demobilizationId: string,
    notes?: string
  ): Promise<{ success: boolean; pallet_id?: string; code?: string; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_create_demobilization_pallet', {
        p_demobilization_id: demobilizationId,
        p_notes: notes || null,
      })

      if (error) {
        console.error('Erro na RPC fn_create_demobilization_pallet:', error)
        return { success: false, error: error.message }
      }

      const res = data as any
      return {
        success: true,
        pallet_id: res?.pallet_id,
        code: res?.code,
      }
    }

    return { success: true, pallet_id: 'mock-p-id', code: 'DES-000001' }
  },

  /**
   * Create an operational pallet directly from any location (Obra, Galpão, Fornecedor)
   */
  async createOperationalPallet(
    originLocationId: string,
    destinationLocationId?: string | null,
    demobilizationId?: string | null,
    notes?: string
  ): Promise<{ success: boolean; pallet_id?: string; code?: string; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_create_operational_pallet', {
        p_origin_location_id: originLocationId,
        p_destination_location_id: destinationLocationId || null,
        p_demobilization_id: demobilizationId || null,
        p_notes: notes || null,
      })

      if (error) {
        console.error('Erro na RPC fn_create_operational_pallet:', error)
        return { success: false, error: error.message }
      }

      const res = data as any
      return {
        success: true,
        pallet_id: res?.pallet_id,
        code: res?.code,
      }
    }

    return { success: true, pallet_id: 'mock-p-id', code: 'DES-000001' }
  },

  /**
   * Add material to demobilization pallet (Transactional reservation)
   */
  async addMaterialToPallet(
    palletId: string,
    materialId: string,
    quantity: number,
    idempotencyKey?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const key = idempotencyKey || `add-mat-${palletId}-${materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_add_material_to_demob_pallet', {
        p_pallet_id: palletId,
        p_material_id: materialId,
        p_quantity: quantity,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_add_material_to_demob_pallet:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }

    return { success: true, data: { added_quantity: quantity } }
  },

  /**
   * Remove material from demobilization pallet (Release RESERVADO to DISPONIVEL)
   */
  async removeMaterialFromPallet(
    palletId: string,
    materialId: string,
    quantity: number,
    idempotencyKey?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const key = idempotencyKey || `rem-mat-${palletId}-${materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_remove_material_from_demob_pallet', {
        p_pallet_id: palletId,
        p_material_id: materialId,
        p_quantity: quantity,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_remove_material_from_demob_pallet:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }

    return { success: true, data: { removed_quantity: quantity } }
  },

  /**
   * Mark pallet as ready (EM_MONTAGEM -> PRONTO)
   */
  async markPalletReady(
    palletId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const key = idempotencyKey || `ready-pallet-${palletId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_mark_demob_pallet_ready', {
        p_pallet_id: palletId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_mark_demob_pallet_ready:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }

    return { success: true }
  },

  /**
   * Reopen pallet (PRONTO -> EM_MONTAGEM)
   */
  async reopenPallet(
    palletId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const key = idempotencyKey || `reopen-pallet-${palletId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_reopen_demob_pallet', {
        p_pallet_id: palletId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_reopen_demob_pallet:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }

    return { success: true }
  },

  /**
   * Release pallet stock (Desmontar/Liberar pallet)
   */
  async releasePalletStock(
    palletId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const key = idempotencyKey || `release-pallet-${palletId}-${Date.now()}`

    if (isSupabaseConfigured) {
      let { data, error } = await supabase.rpc('fn_release_demob_pallet_stock', {
        p_pallet_id: palletId,
        p_idempotency_key: key,
      })

      if (error && error.message?.includes('function fn_release_demob_pallet_stock')) {
        const fallback = await supabase.rpc('fn_release_pallet_stock', {
          p_pallet_id: palletId,
          p_idempotency_key: key,
        })
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('Erro na RPC fn_release_demob_pallet_stock:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }

    return { success: true }
  },

  /**
   * Get available materials in a work (only bucket = 'DISPONIVEL' and quantity > 0)
   */
  async getWorkAvailableMaterials(workLocationId: string): Promise<StockBalanceWithDetails[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('stock_balances')
        .select(`
          *,
          material:materials(*),
          location:locations(*)
        `)
        .eq('location_id', workLocationId)
        .eq('bucket', 'DISPONIVEL')
        .gt('quantity', 0)
        .order('quantity', { ascending: false })

      if (error) {
        console.error('Erro ao buscar materiais disponíveis na obra:', error)
        return []
      }

      return (data || []) as unknown as StockBalanceWithDetails[]
    }

    return []
  },

  /**
   * Local fallback getter
   */
  async getLocalDemobilizations(filters?: {
    workId?: string
    status?: string
    targetLocationId?: string
  }): Promise<DemobilizationWithRelations[]> {
    return []
  },
}
