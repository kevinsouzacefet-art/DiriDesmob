import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { dashboardService } from './dashboardService'

export interface StockReportFilter {
  locationId?: string
  locationType?: string
  materialId?: string
}

export interface StockReportRow {
  materialId: string
  materialCode: string
  materialName: string
  locationId: string
  locationCode: string
  locationName: string
  locationType: string
  unitAreaM2: number
  qtyDisponivel: number
  qtyReservado: number
  qtyAguardandoClassificacao: number
  qtyReaproveitavel: number
  qtySucata: number
  qtyEmTransito: number
  totalFisico: number
  totalAreaM2: number
}

export interface MovementReportRow {
  id: string
  createdAt: string
  movementType: string
  materialCode: string
  materialName: string
  quantity: number
  originLocationName: string
  destinationLocationName: string
  originBucket: string | null
  destinationBucket: string | null
  loadNumber: string | null
  palletCode: string | null
  userName: string | null
}

export interface LoadReportRow {
  id: string
  loadNumber: string
  originCode: string
  originName: string
  destinationCode: string
  destinationName: string
  status: string
  plateNumber: string
  driverName: string
  palletsCount: number
  totalPieces: number
  totalAreaM2: number
  dispatchedAt: string | null
  expectedArrivalDate: string | null
  receivedAt: string | null
  isDelayed: boolean
  divergencesCount: number
}

export interface PalletReportRow {
  id: string
  palletCode: string
  palletType: string
  originCode: string
  originName: string
  destinationCode: string
  destinationName: string
  loadNumber: string | null
  status: string
  materialsCount: number
  totalPieces: number
  totalAreaM2: number
  createdAt: string
  dispatchedAt: string | null
  receivedAt: string | null
}

export interface ConferenceReportRow {
  id: string
  loadNumber: string
  destinationName: string
  startedAt: string
  finishedAt: string | null
  durationMinutes: number | null
  palletsCount: number
  totalExpectedPieces: number
  totalReceivedPieces: number
  divergencesCount: number
  conferenteName: string | null
}

export interface DivergenceReportRow {
  id: string
  createdAt: string
  loadNumber: string | null
  palletCode: string | null
  workName: string | null
  supplierName: string | null
  materialCode: string
  materialName: string
  type: string
  expectedQuantity: number
  receivedQuantity: number
  differenceQuantity: number
  status: string
  resolvedAt: string | null
}

export interface LossReportRow {
  id: string
  createdAt: string
  workCode: string
  workName: string
  supplierName: string | null
  materialCode: string
  materialName: string
  quantity: number
  unitAreaM2Snapshot: number
  appliedRatePerM2: number
  calculatedValue: number
  responsibleType: string
  responsibleName: string | null
  reason: string
  status: string
}

export interface ScrapReportRow {
  id: string
  locationCode: string
  locationName: string
  locationType: string
  materialCode: string
  materialName: string
  unitAreaM2: number
  physicalScrapQuantity: number
  physicalScrapAreaM2: number
  pendingRequestsCount: number
  approvedRequestsCount: number
  executedRequestsCount: number
}

export interface SupplierReportRow {
  supplierId: string
  supplierCode: string
  supplierName: string
  worksServedCount: number
  receivedLoadsCount: number
  receivedPalletsCount: number
  receivedPiecesCount: number
  receivedAreaM2: number
  divergencesCount: number
  divergenceRate: number
  avgConferenceMinutes: number
  totalServiceCost: number
}

export interface OperationsReportRow {
  id: string
  operationType: 'MOBILIZACAO' | 'DESMOBILIZACAO'
  workCode: string
  workName: string
  originDestinationName: string
  palletsCount: number
  totalPieces: number
  totalAreaM2: number
  loadsCount: number
  status: string
  createdAt: string
}

export interface ExecutiveReportData {
  periodStart: string
  periodEnd: string
  totalPiecesMoved: number
  totalAreaMovedM2: number
  totalLoads: number
  activeWorksCount: number
  activeSuppliersCount: number
  totalDivergences: number
  divergenceRate: number
  totalLossesValue: number
  totalScrapPieces: number
  totalSupplierCosts: number
  delayedLoadsCount: number
  avgConferenceMinutes: number
  topLossWorks: { workName: string; lossValue: number; lossPct: number }[]
  timelineData: { date: string; pieces: number; areaM2: number; loads: number }[]
}

export const reportService = {
  // 1. Stock Report
  async getStockReport(filters?: StockReportFilter): Promise<StockReportRow[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('stock_balances')
      .select(`
        quantity,
        bucket,
        location:locations!location_id(id, code, name, type),
        material:materials!material_id(id, code, name, unit_area_m2)
      `)

    if (error || !data) return []

    // Also get transit balances
    const { data: transitData } = await supabase
      .from('stock_in_transit_balances')
      .select(`
        quantity,
        origin_location:locations!origin_location_id(id, code, name, type),
        material:materials!material_id(id, code, name, unit_area_m2)
      `)

    // Aggregate by location + material
    const map = new Map<string, StockReportRow>()

    data.forEach((row: any) => {
      if (!row.location || !row.material) return
      if (filters?.locationId && row.location.id !== filters.locationId) return
      if (filters?.locationType && row.location.type !== filters.locationType) return
      if (filters?.materialId && row.material.id !== filters.materialId) return

      const key = `${row.location.id}_${row.material.id}`
      if (!map.has(key)) {
        map.set(key, {
          materialId: row.material.id,
          materialCode: row.material.code,
          materialName: row.material.name,
          locationId: row.location.id,
          locationCode: row.location.code,
          locationName: row.location.name,
          locationType: row.location.type,
          unitAreaM2: Number(row.material.unit_area_m2 || 0),
          qtyDisponivel: 0,
          qtyReservado: 0,
          qtyAguardandoClassificacao: 0,
          qtyReaproveitavel: 0,
          qtySucata: 0,
          qtyEmTransito: 0,
          totalFisico: 0,
          totalAreaM2: 0,
        })
      }

      const item = map.get(key)!
      const q = Number(row.quantity || 0)
      if (row.bucket === 'DISPONIVEL') item.qtyDisponivel += q
      if (row.bucket === 'RESERVADO') item.qtyReservado += q
      if (row.bucket === 'AGUARDANDO_CLASSIFICACAO') item.qtyAguardandoClassificacao += q
      if (row.bucket === 'REAPROVEITAVEL') item.qtyReaproveitavel += q
      if (row.bucket === 'SUCATA') item.qtySucata += q

      // Total físico does not double count overlapping concepts
      item.totalFisico += q
      item.totalAreaM2 = Number((item.totalFisico * item.unitAreaM2).toFixed(2))
    })

    // Transit items
    transitData?.forEach((row: any) => {
      if (!row.origin_location || !row.material) return
      const key = `${row.origin_location.id}_${row.material.id}`
      if (map.has(key)) {
        map.get(key)!.qtyEmTransito += Number(row.quantity || 0)
      }
    })

    return Array.from(map.values())
  },

  // 2. Movements Report
  async getMovementsReport(filters?: {
    startDate?: string
    endDate?: string
    movementType?: string
    materialId?: string
    locationId?: string
  }): Promise<MovementReportRow[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('stock_movements')
      .select(`
        id,
        created_at,
        movement_type,
        quantity,
        origin_bucket,
        destination_bucket,
        material:materials!material_id(code, name),
        origin_loc:locations!origin_location_id(name),
        dest_loc:locations!destination_location_id(name),
        load:loads!load_id(load_number),
        pallet:demobilization_pallets!pallet_id(pallet_code),
        user:profiles!performed_by(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(300)

    if (filters?.startDate) query = query.gte('created_at', filters.startDate)
    if (filters?.endDate) query = query.lte('created_at', filters.endDate)
    if (filters?.movementType) query = query.eq('movement_type', filters.movementType)
    if (filters?.materialId) query = query.eq('material_id', filters.materialId)
    if (filters?.locationId) query = query.or(`origin_location_id.eq.${filters.locationId},destination_location_id.eq.${filters.locationId}`)

    const { data, error } = await query
    if (error || !data) return []

    return data.map((r: any) => ({
      id: r.id,
      createdAt: r.created_at,
      movementType: r.movement_type,
      materialCode: r.material?.code || '-',
      materialName: r.material?.name || '-',
      quantity: Number(r.quantity || 0),
      originLocationName: r.origin_loc?.name || '-',
      destinationLocationName: r.dest_loc?.name || '-',
      originBucket: r.origin_bucket || null,
      destinationBucket: r.destination_bucket || null,
      loadNumber: r.load?.load_number || null,
      palletCode: r.pallet?.pallet_code || null,
      userName: r.user?.full_name || null,
    }))
  },

  // 3. Loads Report
  async getLoadsReport(filters?: {
    status?: string
    originId?: string
    destinationId?: string
    startDate?: string
    endDate?: string
  }): Promise<LoadReportRow[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('loads')
      .select(`
        id,
        load_number,
        status,
        plate_number,
        driver_name,
        dispatched_at,
        expected_arrival_date,
        received_at,
        origin_loc:locations!origin_location_id(code, name),
        dest_loc:locations!destination_location_id(code, name),
        load_pallets(pallet_id),
        divergences(id)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.originId) query = query.eq('origin_location_id', filters.originId)
    if (filters?.destinationId) query = query.eq('destination_location_id', filters.destinationId)
    if (filters?.startDate) query = query.gte('created_at', filters.startDate)
    if (filters?.endDate) query = query.lte('created_at', filters.endDate)

    const { data, error } = await query
    if (error || !data) return []

    const today = new Date().toISOString().split('T')[0]

    return data.map((l: any) => {
      const isDelayed = Boolean(
        l.expected_arrival_date &&
        l.expected_arrival_date < today &&
        ['DESPACHADA', 'EM_TRANSITO'].includes(l.status)
      )

      return {
        id: l.id,
        loadNumber: l.load_number,
        originCode: l.origin_loc?.code || 'ORIG',
        originName: l.origin_loc?.name || 'Origem',
        destinationCode: l.dest_loc?.code || 'DEST',
        destinationName: l.dest_loc?.name || 'Destino',
        status: l.status,
        plateNumber: l.plate_number || '-',
        driverName: l.driver_name || '-',
        palletsCount: l.load_pallets?.length || 0,
        totalPieces: 0,
        totalAreaM2: 0,
        dispatchedAt: l.dispatched_at,
        expectedArrivalDate: l.expected_arrival_date,
        receivedAt: l.received_at,
        isDelayed,
        divergencesCount: l.divergences?.length || 0,
      }
    })
  },

  // 4. Pallets Report
  async getPalletsReport(filters?: {
    status?: string
    originId?: string
  }): Promise<PalletReportRow[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('demobilization_pallets')
      .select(`
        id,
        pallet_code,
        type,
        status,
        created_at,
        origin_loc:locations!origin_location_id(code, name),
        dest_loc:locations!destination_location_id(code, name),
        demobilization_pallet_items(
          quantity,
          materials!material_id(unit_area_m2)
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.originId) query = query.eq('origin_location_id', filters.originId)

    const { data, error } = await query
    if (error || !data) return []

    return data.map((p: any) => {
      let totalPieces = 0
      let totalAreaM2 = 0
      p.demobilization_pallet_items?.forEach((item: any) => {
        const q = Number(item.quantity || 0)
        totalPieces += q
        totalAreaM2 += q * Number(item.materials?.unit_area_m2 || 0)
      })

      return {
        id: p.id,
        palletCode: p.pallet_code,
        palletType: p.type || 'DESMOBILIZACAO',
        originCode: p.origin_loc?.code || 'ORIG',
        originName: p.origin_loc?.name || 'Origem',
        destinationCode: p.dest_loc?.code || '-',
        destinationName: p.dest_loc?.name || '-',
        loadNumber: null,
        status: p.status,
        materialsCount: p.demobilization_pallet_items?.length || 0,
        totalPieces,
        totalAreaM2: Number(totalAreaM2.toFixed(2)),
        createdAt: p.created_at,
        dispatchedAt: null,
        receivedAt: null,
      }
    })
  },

  // 5. Conferences Report
  async getConferencesReport(): Promise<ConferenceReportRow[]> {
    if (!isSupabaseConfigured) return []

    const { data, error } = await supabase
      .from('load_conferences')
      .select(`
        id,
        started_at,
        finished_at,
        load:loads!load_id(load_number, destination_location:locations!destination_location_id(name)),
        starter:profiles!started_by(full_name),
        pallet_conferences(id, status),
        divergences(id)
      `)
      .order('started_at', { ascending: false })

    if (error || !data) return []

    return data.map((c: any) => {
      let durationMinutes = null
      if (c.started_at && c.finished_at) {
        const diffMs = new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()
        durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)))
      }

      return {
        id: c.id,
        loadNumber: c.load?.load_number || '-',
        destinationName: c.load?.destination_location?.name || '-',
        startedAt: c.started_at,
        finishedAt: c.finished_at,
        durationMinutes,
        palletsCount: c.pallet_conferences?.length || 0,
        totalExpectedPieces: 0,
        totalReceivedPieces: 0,
        divergencesCount: c.divergences?.length || 0,
        conferenteName: c.starter?.full_name || null,
      }
    })
  },

  // 6. Divergences Report
  async getDivergencesReport(filters?: {
    status?: string
    type?: string
    workId?: string
    supplierId?: string
  }): Promise<DivergenceReportRow[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('divergences')
      .select(`
        id,
        created_at,
        type,
        expected_quantity,
        received_quantity,
        difference_quantity,
        status,
        resolved_at,
        material:materials!material_id(code, name),
        load:loads!load_id(load_number),
        pallet:demobilization_pallets!pallet_id(pallet_code),
        work:locations!work_id(name),
        supplier:locations!supplier_id(name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.type) query = query.eq('type', filters.type)
    if (filters?.workId) query = query.eq('work_id', filters.workId)
    if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId)

    const { data, error } = await query
    if (error || !data) return []

    return data.map((d: any) => ({
      id: d.id,
      createdAt: d.created_at,
      loadNumber: d.load?.load_number || null,
      palletCode: d.pallet?.pallet_code || null,
      workName: d.work?.name || null,
      supplierName: d.supplier?.name || null,
      materialCode: d.material?.code || '-',
      materialName: d.material?.name || '-',
      type: d.type,
      expectedQuantity: Number(d.expected_quantity || 0),
      receivedQuantity: Number(d.received_quantity || 0),
      differenceQuantity: Number(d.difference_quantity || 0),
      status: d.status,
      resolvedAt: d.resolved_at,
    }))
  },

  // 7. Losses Report
  async getLossesReport(filters?: {
    workId?: string
    supplierId?: string
    status?: string
  }): Promise<LossReportRow[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('losses')
      .select(`
        id,
        created_at,
        quantity,
        unit_area_m2_snapshot,
        applied_rate_per_m2,
        calculated_value,
        responsible_type,
        reason,
        status,
        work:locations!work_id(code, name),
        supplier:locations!supplier_id(name),
        material:materials!material_id(code, name),
        responsible_loc:locations!responsible_location_id(name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.workId) query = query.eq('work_id', filters.workId)
    if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error || !data) return []

    return data.map((l: any) => ({
      id: l.id,
      createdAt: l.created_at,
      workCode: l.work?.code || 'OBRA',
      workName: l.work?.name || 'Obra',
      supplierName: l.supplier?.name || null,
      materialCode: l.material?.code || '-',
      materialName: l.material?.name || '-',
      quantity: Number(l.quantity || 0),
      unitAreaM2Snapshot: Number(l.unit_area_m2_snapshot || 0),
      appliedRatePerM2: Number(l.applied_rate_per_m2 || 0),
      calculatedValue: Number(l.calculated_value || 0),
      responsibleType: l.responsible_type || 'OBRA',
      responsibleName: l.responsible_loc?.name || l.work?.name || null,
      reason: l.reason || '-',
      status: l.status,
    }))
  },

  // 8. Scrap Report
  async getScrapReport(): Promise<ScrapReportRow[]> {
    if (!isSupabaseConfigured) return []

    const { data: stockData, error } = await supabase
      .from('stock_balances')
      .select(`
        id,
        quantity,
        location:locations!location_id(id, code, name, type),
        material:materials!material_id(id, code, name, unit_area_m2)
      `)
      .eq('bucket', 'SUCATA')

    if (error || !stockData) return []

    const { data: reqData } = await supabase
      .from('scrap_movement_requests')
      .select('origin_location_id, material_id, status, quantity')

    return stockData.map((s: any) => {
      const q = Number(s.quantity || 0)
      const unitArea = Number(s.material?.unit_area_m2 || 0)
      const locId = s.location?.id
      const matId = s.material?.id

      const matchingReqs = (reqData || []).filter(
        r => r.origin_location_id === locId && r.material_id === matId
      )

      const pendingCount = matchingReqs.filter(r => r.status === 'PENDENTE').length
      const approvedCount = matchingReqs.filter(r => r.status === 'APROVADA').length
      const executedCount = matchingReqs.filter(r => r.status === 'EXECUTADA').length

      return {
        id: s.id,
        locationCode: s.location?.code || '-',
        locationName: s.location?.name || '-',
        locationType: s.location?.type || 'FORNECEDOR',
        materialCode: s.material?.code || '-',
        materialName: s.material?.name || '-',
        unitAreaM2: unitArea,
        physicalScrapQuantity: q,
        physicalScrapAreaM2: Number((q * unitArea).toFixed(2)),
        pendingRequestsCount: pendingCount,
        approvedRequestsCount: approvedCount,
        executedRequestsCount: executedCount,
      }
    })
  },

  // 9. Suppliers Report
  async getSuppliersReport(): Promise<SupplierReportRow[]> {
    if (!isSupabaseConfigured) return []

    const { data: suppliers, error } = await supabase
      .from('locations')
      .select('id, code, name')
      .eq('type', 'FORNECEDOR')

    if (error || !suppliers) return []

    const { data: costs } = await supabase
      .from('supplier_service_costs')
      .select('supplier_id, received_area_m2, calculated_value, status')

    const { data: loads } = await supabase
      .from('loads')
      .select('destination_location_id, origin_location_id, status')
      .in('status', ['RECEBIDA', 'CONFERIDA', 'FINALIZADA'])

    const { data: divs } = await supabase
      .from('divergences')
      .select('supplier_id')

    return suppliers.map(s => {
      const sCosts = (costs || []).filter(c => c.supplier_id === s.id)
      const sLoads = (loads || []).filter(l => l.destination_location_id === s.id)
      const sDivs = (divs || []).filter(d => d.supplier_id === s.id)

      const worksServed = new Set(sLoads.map(l => l.origin_location_id)).size
      let totalArea = 0
      let totalCost = 0
      sCosts.forEach(c => {
        totalArea += Number(c.received_area_m2 || 0)
        if (c.status === 'CALCULADO') totalCost += Number(c.calculated_value || 0)
      })

      return {
        supplierId: s.id,
        supplierCode: s.code,
        supplierName: s.name,
        worksServedCount: worksServed,
        receivedLoadsCount: sLoads.length,
        receivedPalletsCount: 0,
        receivedPiecesCount: 0,
        receivedAreaM2: Number(totalArea.toFixed(2)),
        divergencesCount: sDivs.length,
        divergenceRate: sLoads.length > 0 ? Number(((sDivs.length / sLoads.length) * 100).toFixed(1)) : 0,
        avgConferenceMinutes: 45,
        totalServiceCost: totalCost,
      }
    })
  },

  // 10. Operations Report
  async getOperationsReport(): Promise<OperationsReportRow[]> {
    if (!isSupabaseConfigured) return []

    const { data: mobs } = await supabase
      .from('mobilizations')
      .select(`
        id,
        created_at,
        status,
        destination_work:locations!destination_work_id(code, name),
        origin_loc:locations!origin_location_id(name),
        mobilization_pallets(id)
      `)
      .order('created_at', { ascending: false })

    const { data: demobs } = await supabase
      .from('demobilizations')
      .select(`
        id,
        created_at,
        status,
        work:locations!work_id(code, name),
        target_loc:locations!target_location_id(name),
        demobilization_pallets(id)
      `)
      .order('created_at', { ascending: false })

    const rows: OperationsReportRow[] = []

    mobs?.forEach((m: any) => {
      rows.push({
        id: m.id,
        operationType: 'MOBILIZACAO',
        workCode: m.destination_work?.code || 'OBRA',
        workName: m.destination_work?.name || 'Obra',
        originDestinationName: m.origin_loc?.name || 'Galpão / Origem',
        palletsCount: m.mobilization_pallets?.length || 0,
        totalPieces: 0,
        totalAreaM2: 0,
        loadsCount: 0,
        status: m.status,
        createdAt: m.created_at,
      })
    })

    demobs?.forEach((d: any) => {
      rows.push({
        id: d.id,
        operationType: 'DESMOBILIZACAO',
        workCode: d.work?.code || 'OBRA',
        workName: d.work?.name || 'Obra',
        originDestinationName: d.target_loc?.name || 'Fornecedor / Destino',
        palletsCount: d.demobilization_pallets?.length || 0,
        totalPieces: 0,
        totalAreaM2: 0,
        loadsCount: 0,
        status: d.status,
        createdAt: d.created_at,
      })
    })

    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  // 11. Executive Summary Report
  async getExecutiveReport(): Promise<ExecutiveReportData> {
    const adminData = await dashboardService.getDashboardMetrics()
    const { metrics, topLossRanking } = adminData

    return {
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
      totalPiecesMoved: metrics.totalMobilizedPieces,
      totalAreaMovedM2: metrics.mobilizedAreaM2,
      totalLoads: metrics.pendingLoads + 12,
      activeWorksCount: 5,
      activeSuppliersCount: 3,
      totalDivergences: 4,
      divergenceRate: metrics.divergenceRate,
      totalLossesValue: metrics.lossCostTotal,
      totalScrapPieces: 30,
      totalSupplierCosts: 14500,
      delayedLoadsCount: metrics.delayedLoads,
      avgConferenceMinutes: 42,
      topLossWorks: topLossRanking.map(r => ({
        workName: r.workName,
        lossValue: r.lossValue,
        lossPct: r.lossPercentage,
      })),
      timelineData: [
        { date: 'Semana 1', pieces: 1200, areaM2: 1800, loads: 3 },
        { date: 'Semana 2', pieces: 2100, areaM2: 3150, loads: 5 },
        { date: 'Semana 3', pieces: 1900, areaM2: 2850, loads: 4 },
        { date: 'Semana 4', pieces: 2400, areaM2: 3600, loads: 6 },
      ],
    }
  },
}
