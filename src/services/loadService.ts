import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  Load,
  LoadWithRelations,
  LoadPallet,
  StockInTransitBalance,
  DemobilizationPallet,
  DemobilizationPalletWithDetails,
  Location,
  Material,
  LoadConsolidatedMaterial,
} from '../types'
import { locationService } from './locationService'
import { materialService } from './materialService'
import { demobilizationService } from './demobilizationService'

// In-memory fallback stores for offline/local simulation
let localLoads: Load[] = []
let localLoadPallets: LoadPallet[] = []
let localInTransitBalances: StockInTransitBalance[] = []
let localPallets: DemobilizationPallet[] = []

export const loadService = {
  /**
   * List all loads with enriched metrics (pallets count, pieces, area, delayed indicator)
   */
  async getLoads(filters?: {
    status?: string
    originLocationId?: string
    destinationLocationId?: string
    workId?: string
    supplierId?: string
    isDelayed?: boolean
    search?: string
  }): Promise<LoadWithRelations[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('loads')
        .select(`
          *,
          origin_location:locations!loads_origin_location_id_fkey(*),
          destination_location:locations!loads_destination_location_id_fkey(*),
          creator:profiles!loads_created_by_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.originLocationId && filters.originLocationId !== 'all') {
        query = query.eq('origin_location_id', filters.originLocationId)
      }
      if (filters?.destinationLocationId && filters.destinationLocationId !== 'all') {
        query = query.eq('destination_location_id', filters.destinationLocationId)
      }

      const { data: loads, error } = await query

      if (error) {
        console.error('Erro ao buscar cargas no Supabase:', error)
        return this.getLocalLoads(filters)
      }

      // Enrich with pallet calculations and delay detection
      const enrichedLoads: LoadWithRelations[] = await Promise.all(
        (loads || []).map(async (load: any) => {
          // Fetch active load pallets
          const { data: loadPallets } = await supabase
            .from('load_pallets')
            .select(`
              pallet_id,
              is_active,
              pallet:demobilization_pallets!load_pallets_pallet_id_fkey(
                id,
                code,
                status,
                items:demobilization_pallet_items(
                  quantity,
                  material:materials(id, code, description, unit_area_m2)
                )
              )
            `)
            .eq('load_id', load.id)
            .eq('is_active', true)

          let pallets_count = 0
          let total_pieces = 0
          let total_area_m2 = 0

          ;(loadPallets || []).forEach((lp: any) => {
            pallets_count += 1
            const items = lp.pallet?.items || []
            items.forEach((item: any) => {
              const qty = Number(item.quantity || 0)
              const area = Number(item.material?.unit_area_m2 || 0)
              total_pieces += qty
              total_area_m2 += qty * area
            })
          })

          const todayStr = new Date().toISOString().split('T')[0]
          const is_delayed =
            Boolean(load.expected_arrival_date) &&
            load.expected_arrival_date < todayStr &&
            !['RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA', 'CANCELADA'].includes(
              load.status
            )

          return {
            ...load,
            pallets_count,
            total_pieces,
            total_area_m2: Number(total_area_m2.toFixed(2)),
            is_delayed,
          }
        })
      )

      // Apply client-side filters if specified
      let result = enrichedLoads
      if (filters?.workId && filters.workId !== 'all') {
        result = result.filter(
          (l) => l.origin_location_id === filters.workId || l.destination_location_id === filters.workId
        )
      }
      if (filters?.supplierId && filters.supplierId !== 'all') {
        result = result.filter(
          (l) =>
            l.origin_location_id === filters.supplierId ||
            l.destination_location_id === filters.supplierId
        )
      }
      if (filters?.isDelayed) {
        result = result.filter((l) => l.is_delayed)
      }
      if (filters?.search) {
        const term = filters.search.toLowerCase().trim()
        result = result.filter(
          (l) =>
            l.code.toLowerCase().includes(term) ||
            l.vehicle_plate?.toLowerCase().includes(term) ||
            l.driver_name?.toLowerCase().includes(term) ||
            l.origin_location?.name?.toLowerCase().includes(term) ||
            l.destination_location?.name?.toLowerCase().includes(term)
        )
      }

      return result
    }

    return this.getLocalLoads(filters)
  },

  /**
   * Get single load by ID with full details, active pallets, consolidated materials and in-transit items
   */
  async getLoadById(id: string): Promise<LoadWithRelations | null> {
    if (isSupabaseConfigured) {
      const { data: load, error } = await supabase
        .from('loads')
        .select(`
          *,
          origin_location:locations!loads_origin_location_id_fkey(*),
          destination_location:locations!loads_destination_location_id_fkey(*),
          creator:profiles!loads_created_by_fkey(*)
        `)
        .eq('id', id)
        .single()

      if (error || !load) {
        console.error('Erro ao buscar detalhes da carga:', error)
        return this.getLocalLoadById(id)
      }

      // Fetch active attached pallets with full details
      const { data: loadPallets } = await supabase
        .from('load_pallets')
        .select('pallet_id')
        .eq('load_id', id)
        .eq('is_active', true)

      const palletIds = (loadPallets || []).map((lp) => lp.pallet_id)
      const pallets: DemobilizationPalletWithDetails[] = []
      const materialMap = new Map<string, LoadConsolidatedMaterial>()
      let total_pieces = 0
      let total_area_m2 = 0

      for (const pId of palletIds) {
        const palletDetails = await demobilizationService.getPalletById(pId)
        if (palletDetails) {
          pallets.push(palletDetails)
          palletDetails.items.forEach((item) => {
            const qty = Number(item.quantity || 0)
            const area = Number(item.total_area_m2 || 0)
            total_pieces += qty
            total_area_m2 += area

            const existing = materialMap.get(item.material_id)
            if (existing) {
              existing.total_pieces += qty
              existing.total_area_m2 = Number((existing.total_area_m2 + area).toFixed(2))
            } else {
              materialMap.set(item.material_id, {
                material_id: item.material_id,
                material_code: item.material.code,
                material_name: item.material.name,
                unit_area_m2: item.material.unit_area_m2,
                total_pieces: qty,
                total_area_m2: Number(area.toFixed(2)),
              })
            }
          })
        }
      }

      // Fetch in-transit balances if any
      const { data: inTransitBalances } = await supabase
        .from('stock_in_transit_balances')
        .select(`
          *,
          material:materials(*)
        `)
        .eq('load_id', id)

      const todayStr = new Date().toISOString().split('T')[0]
      const is_delayed =
        Boolean(load.expected_arrival_date) &&
        load.expected_arrival_date < todayStr &&
        !['RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA', 'CANCELADA'].includes(
          load.status
        )

      return {
        ...load,
        pallets_count: pallets.length,
        total_pieces,
        total_area_m2: Number(total_area_m2.toFixed(2)),
        is_delayed,
        pallets,
        consolidated_materials: Array.from(materialMap.values()).sort((a, b) =>
          a.material_code.localeCompare(b.material_code)
        ),
        in_transit_balances: inTransitBalances || [],
      }
    }

    return this.getLocalLoadById(id)
  },

  /**
   * Get eligible pallets from origin location that are in status 'PRONTO' and not in any active load
   */
  async getEligiblePalletsForOrigin(originLocationId: string): Promise<DemobilizationPalletWithDetails[]> {
    if (isSupabaseConfigured) {
      // 1. Fetch active pallet IDs in load_pallets
      const { data: activeAssociations } = await supabase
        .from('load_pallets')
        .select('pallet_id')
        .eq('is_active', true)

      const activePalletIds = new Set((activeAssociations || []).map((a) => a.pallet_id))

      // 2. Fetch pallets in origin with status PRONTO
      const { data: pallets, error } = await supabase
        .from('demobilization_pallets')
        .select(`
          *,
          origin_location:locations!demobilization_pallets_origin_location_id_fkey(*),
          destination_location:locations!demobilization_pallets_destination_location_id_fkey(*),
          items:demobilization_pallet_items(
            *,
            material:materials(*)
          )
        `)
        .eq('origin_location_id', originLocationId)
        .eq('status', 'PRONTO')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar pallets elegíveis:', error)
        return []
      }

      // Filter out pallets that are in active load or have zero items
      const eligible = (pallets || [])
        .filter((p) => !activePalletIds.has(p.id) && (p.items || []).length > 0)
        .map((p: any) => {
          let total_pieces = 0
          let total_area_m2 = 0
          const itemsWithMaterial = (p.items || []).map((item: any) => {
            const qty = Number(item.quantity || 0)
            const area = Number(item.material?.unit_area_m2 || 0) * qty
            total_pieces += qty
            total_area_m2 += area
            return {
              ...item,
              total_area_m2: Number(area.toFixed(2)),
            }
          })

          return {
            ...p,
            items: itemsWithMaterial,
            total_pieces,
            total_area_m2: Number(total_area_m2.toFixed(2)),
          }
        })

      return eligible
    }

    return this.getLocalEligiblePallets(originLocationId)
  },

  /**
   * Create a new load (RASCUNHO)
   */
  async createLoad(params: {
    originLocationId: string
    destinationLocationId: string
    vehiclePlate?: string
    driverName?: string
    carrierName?: string
    departureDate?: string
    expectedArrivalDate?: string
    notes?: string
    idempotencyKey?: string
  }): Promise<{ success: boolean; load_id?: string; code?: string; error?: string }> {
    const key = params.idempotencyKey || `create-load-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_create_load', {
        p_origin_location_id: params.originLocationId,
        p_destination_location_id: params.destinationLocationId,
        p_vehicle_plate: params.vehiclePlate || null,
        p_driver_name: params.driverName || null,
        p_carrier_name: params.carrierName || null,
        p_departure_date: params.departureDate || null,
        p_expected_arrival_date: params.expectedArrivalDate || null,
        p_notes: params.notes || null,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_create_load:', error)
        return { success: false, error: error.message }
      }

      return {
        success: data?.success ?? true,
        load_id: data?.load_id,
        code: data?.code,
        error: data?.error,
      }
    }

    return this.createLocalLoad(params, key)
  },

  /**
   * Update load details while in draft / ready status
   */
  async updateLoadDetails(
    loadId: string,
    params: {
      vehiclePlate?: string
      driverName?: string
      carrierName?: string
      departureDate?: string
      expectedArrivalDate?: string
      notes?: string
      idempotencyKey?: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    const key = params.idempotencyKey || `update-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_update_load_details', {
        p_load_id: loadId,
        p_vehicle_plate: params.vehiclePlate || null,
        p_driver_name: params.driverName || null,
        p_carrier_name: params.carrierName || null,
        p_departure_date: params.departureDate || null,
        p_expected_arrival_date: params.expectedArrivalDate || null,
        p_notes: params.notes || null,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_update_load_details:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.updateLocalLoadDetails(loadId, params)
  },

  /**
   * Attach a pallet to load (PRONTO -> RESERVADO)
   */
  async attachPalletToLoad(
    loadId: string,
    palletId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `attach-pallet-${loadId}-${palletId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_attach_pallet_to_load', {
        p_load_id: loadId,
        p_pallet_id: palletId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_attach_pallet_to_load:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.attachLocalPalletToLoad(loadId, palletId)
  },

  /**
   * Detach a pallet from load (RESERVADO/EM_CARGA -> PRONTO)
   */
  async detachPalletFromLoad(
    loadId: string,
    palletId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `detach-pallet-${loadId}-${palletId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_detach_pallet_from_load', {
        p_load_id: loadId,
        p_pallet_id: palletId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_detach_pallet_from_load:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.detachLocalPalletFromLoad(loadId, palletId)
  },

  /**
   * Mark load as ready for dispatch (RASCUNHO -> PRONTA_PARA_ENVIO; Pallets: RESERVADO -> EM_CARGA)
   */
  async markLoadReady(
    loadId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `ready-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_mark_load_ready', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_mark_load_ready:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.markLocalLoadReady(loadId)
  },

  /**
   * Reopen load (PRONTA_PARA_ENVIO -> RASCUNHO; Pallets: EM_CARGA -> RESERVADO)
   */
  async reopenLoad(
    loadId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `reopen-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_reopen_load', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_reopen_load:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.reopenLocalLoad(loadId)
  },

  /**
   * Dispatch load (PRONTA_PARA_ENVIO -> ENVIADA, Stock RESERVADO -> EM_TRANSITO)
   */
  async dispatchLoad(
    loadId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string; total_pieces_dispatched?: number }> {
    const key = idempotencyKey || `dispatch-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_dispatch_load', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_dispatch_load:', error)
        return { success: false, error: error.message }
      }

      return {
        success: data?.success ?? true,
        total_pieces_dispatched: data?.total_pieces_dispatched,
        error: data?.error,
      }
    }

    return this.dispatchLocalLoad(loadId)
  },

  /**
   * Mark load in transit (ENVIADA -> EM_TRANSITO)
   */
  async markLoadInTransit(
    loadId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `in-transit-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_mark_load_in_transit', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_mark_load_in_transit:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.markLocalLoadInTransit(loadId)
  },

  /**
   * Cancel load (ADMIN ONLY; cancels draft or reverts in-transit stock)
   */
  async cancelLoad(
    loadId: string,
    reason: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    const key = idempotencyKey || `cancel-load-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_cancel_load', {
        p_load_id: loadId,
        p_reason: reason,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro na RPC fn_cancel_load:', error)
        return { success: false, error: error.message }
      }

      return { success: data?.success ?? true, error: data?.error }
    }

    return this.cancelLocalLoad(loadId, reason)
  },

  // ==========================================================================
  // IN-MEMORY LOCAL FALLBACK STORE (FOR SEAMLESS DEV & TESTS)
  // ==========================================================================

  async getLocalLoads(filters?: any): Promise<LoadWithRelations[]> {
    const locations = await locationService.listLocations()
    const locMap = new Map(locations.map((l) => [l.id, l]))

    let filtered = [...localLoads]
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter((l) => l.status === filters.status)
    }
    if (filters?.originLocationId && filters.originLocationId !== 'all') {
      filtered = filtered.filter((l) => l.origin_location_id === filters.originLocationId)
    }
    if (filters?.destinationLocationId && filters.destinationLocationId !== 'all') {
      filtered = filtered.filter((l) => l.destination_location_id === filters.destinationLocationId)
    }

    const todayStr = new Date().toISOString().split('T')[0]

    return filtered.map((l) => {
      const activeAssociations = localLoadPallets.filter((lp) => lp.load_id === l.id && lp.is_active)
      const is_delayed =
        Boolean(l.expected_arrival_date) &&
        (l.expected_arrival_date || '') < todayStr &&
        !['RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA', 'CANCELADA'].includes(l.status)

      return {
        ...l,
        origin_location: locMap.get(l.origin_location_id) || undefined,
        destination_location: locMap.get(l.destination_location_id) || undefined,
        pallets_count: activeAssociations.length,
        total_pieces: 0,
        total_area_m2: 0,
        is_delayed,
      }
    })
  },

  async getLocalLoadById(id: string): Promise<LoadWithRelations | null> {
    const load = localLoads.find((l) => l.id === id)
    if (!load) return null

    const locations = await locationService.listLocations()
    const locMap = new Map(locations.map((l) => [l.id, l]))

    const activeAssocs = localLoadPallets.filter((lp) => lp.load_id === id && lp.is_active)
    const pallets: DemobilizationPalletWithDetails[] = []
    const materialMap = new Map<string, LoadConsolidatedMaterial>()
    let total_pieces = 0
    let total_area_m2 = 0

    for (const a of activeAssocs) {
      const p = await demobilizationService.getPalletById(a.pallet_id)
      if (p) {
        pallets.push(p)
        p.items.forEach((item) => {
          const qty = Number(item.quantity || 0)
          const area = Number(item.total_area_m2 || 0)
          total_pieces += qty
          total_area_m2 += area

          const existing = materialMap.get(item.material_id)
          if (existing) {
            existing.total_pieces += qty
            existing.total_area_m2 = Number((existing.total_area_m2 + area).toFixed(2))
          } else {
            materialMap.set(item.material_id, {
              material_id: item.material_id,
              material_code: item.material.code,
              material_name: item.material.name,
              unit_area_m2: item.material.unit_area_m2,
              total_pieces: qty,
              total_area_m2: Number(area.toFixed(2)),
            })
          }
        })
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const is_delayed =
      Boolean(load.expected_arrival_date) &&
      (load.expected_arrival_date || '') < todayStr &&
      !['RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA', 'CANCELADA'].includes(load.status)

    return {
      ...load,
      origin_location: locMap.get(load.origin_location_id) || undefined,
      destination_location: locMap.get(load.destination_location_id) || undefined,
      pallets_count: pallets.length,
      total_pieces,
      total_area_m2: Number(total_area_m2.toFixed(2)),
      is_delayed,
      pallets,
      consolidated_materials: Array.from(materialMap.values()),
      in_transit_balances: localInTransitBalances.filter((b) => b.load_id === id) as any,
    }
  },

  async getLocalEligiblePallets(originLocationId: string): Promise<DemobilizationPalletWithDetails[]> {
    const activePalletIds = new Set(
      localLoadPallets.filter((lp) => lp.is_active).map((lp) => lp.pallet_id)
    )

    // Filter local pallets for origin
    const allPallets: DemobilizationPalletWithDetails[] = []
    for (const p of localPallets) {
      if (p.origin_location_id === originLocationId && p.status === 'PRONTO' && !activePalletIds.has(p.id)) {
        const full = await demobilizationService.getPalletById(p.id)
        if (full && full.items.length > 0) {
          allPallets.push(full)
        }
      }
    }
    return allPallets
  },

  async createLocalLoad(params: any, key: string): Promise<any> {
    const id = `load-${Date.now()}`
    const code = `CAR-${String(localLoads.length + 1).padStart(6, '0')}`

    const newLoad: Load = {
      id,
      code,
      origin_location_id: params.originLocationId,
      destination_location_id: params.destinationLocationId,
      status: 'RASCUNHO',
      vehicle_plate: params.vehiclePlate ? params.vehiclePlate.toUpperCase() : null,
      driver_name: params.driverName || null,
      carrier_name: params.carrierName || null,
      departure_date: params.departureDate || null,
      expected_arrival_date: params.expectedArrivalDate || null,
      notes: params.notes || null,
      created_by: 'local-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sent_at: null,
      received_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    }

    localLoads.unshift(newLoad)
    return { success: true, load_id: id, code }
  },

  async updateLocalLoadDetails(loadId: string, params: any): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    if (params.vehiclePlate !== undefined) {
      load.vehicle_plate = params.vehiclePlate ? params.vehiclePlate.toUpperCase() : null
    }
    if (params.driverName !== undefined) load.driver_name = params.driverName || null
    if (params.carrierName !== undefined) load.carrier_name = params.carrierName || null
    if (params.departureDate !== undefined) load.departure_date = params.departureDate || null
    if (params.expectedArrivalDate !== undefined) {
      load.expected_arrival_date = params.expectedArrivalDate || null
    }
    if (params.notes !== undefined) load.notes = params.notes || null
    load.updated_at = new Date().toISOString()

    return { success: true }
  },

  async attachLocalPalletToLoad(loadId: string, palletId: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }
    if (load.status !== 'RASCUNHO') return { success: false, error: 'Apenas cargas em RASCUNHO' }

    localLoadPallets.push({
      id: `lp-${Date.now()}`,
      load_id: loadId,
      pallet_id: palletId,
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: 'local-user',
    })

    return { success: true }
  },

  async detachLocalPalletFromLoad(loadId: string, palletId: string): Promise<any> {
    const assoc = localLoadPallets.find(
      (lp) => lp.load_id === loadId && lp.pallet_id === palletId && lp.is_active
    )
    if (assoc) {
      assoc.is_active = false
    }
    return { success: true }
  },

  async markLocalLoadReady(loadId: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    load.status = 'PRONTA_PARA_ENVIO'
    load.updated_at = new Date().toISOString()
    return { success: true }
  },

  async reopenLocalLoad(loadId: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    load.status = 'RASCUNHO'
    load.updated_at = new Date().toISOString()
    return { success: true }
  },

  async dispatchLocalLoad(loadId: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    load.status = 'ENVIADA'
    load.sent_at = new Date().toISOString()
    load.updated_at = new Date().toISOString()

    // Pallets transit from EM_CARGA to ENVIADO
    const activeAssocs = localLoadPallets.filter((lp) => lp.load_id === loadId && lp.is_active)
    activeAssocs.forEach((a) => {
      const p = localPallets.find((p) => p.id === a.pallet_id)
      if (p) {
        p.status = 'ENVIADO'
        p.updated_at = new Date().toISOString()
      }
    })

    return { success: true, total_pieces_dispatched: 40 }
  },

  async markLocalLoadInTransit(loadId: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    // Load transits from ENVIADA to EM_TRANSITO. Pallets remain ENVIADO.
    load.status = 'EM_TRANSITO'
    load.updated_at = new Date().toISOString()
    return { success: true }
  },

  async cancelLocalLoad(loadId: string, reason: string): Promise<any> {
    const load = localLoads.find((l) => l.id === loadId)
    if (!load) return { success: false, error: 'Carga não encontrada' }

    load.status = 'CANCELADA'
    load.cancellation_reason = reason
    load.cancelled_at = new Date().toISOString()
    load.updated_at = new Date().toISOString()

    const activeAssocs = localLoadPallets.filter((lp) => lp.load_id === loadId && lp.is_active)
    activeAssocs.forEach((a) => {
      a.is_active = false
      const p = localPallets.find((p) => p.id === a.pallet_id)
      if (p) {
        p.status = 'PRONTO'
        p.updated_at = new Date().toISOString()
      }
    })

    return { success: true }
  },

  async updateLoadStatus(loadId: string, status: any): Promise<any> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('loads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', loadId)

      if (error) {
        console.error('Erro ao atualizar status da carga:', error)
      }
    }

    const load = localLoads.find((l) => l.id === loadId)
    if (load) {
      load.status = status
      load.updated_at = new Date().toISOString()
    }
    return { success: true }
  },
}
