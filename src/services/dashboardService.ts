import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DashboardMetrics, LossRankingItem } from '../types'

export interface WorkDashboardMetrics {
  workId: string
  workCode: string
  workName: string
  currentStockPieces: number
  currentStockAreaM2: number
  availablePieces: number
  reservedPieces: number
  totalMobilizedPieces: number
  totalDemobilizedPieces: number
  sentLoadsCount: number
  receivedLoadsCount: number
  totalPallets: number
  sentPieces: number
  sentAreaM2: number
  divergencesCount: number
  lossesValue: number
  pendingLoadsCount: number
  delayedLoadsCount: number
}

export interface SupplierDashboardMetrics {
  supplierId: string
  supplierCode: string
  supplierName: string
  receivedLoadsCount: number
  receivedPalletsCount: number
  receivedPiecesCount: number
  receivedAreaM2: number
  loadsPerDay: number
  piecesPerDay: number
  worksServedCount: number
  divergencesCount: number
  awaitingClassificationPieces: number
  reusablePieces: number
  scrapPieces: number
  totalServiceCost: number
  pendingCostCount: number
}

export interface WarehouseDashboardMetrics {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  currentStockPieces: number
  availablePieces: number
  reusablePieces: number
  scrapPieces: number
  receivedLoadsCount: number
  dispatchedLoadsCount: number
  totalPallets: number
  recentMovementsCount: number
}

export const dashboardService = {
  async getDashboardMetrics(filters?: {
    dateRange?: { start?: string; end?: string }
    workId?: string
    supplierId?: string
  }): Promise<{ metrics: DashboardMetrics; topLossRanking: LossRankingItem[] }> {
    if (!isSupabaseConfigured) {
      return {
        metrics: {
          totalMobilizedPieces: 0,
          completedWorks: 0,
          loadsPerDay: 0,
          piecesAtWorks: 0,
          totalPallets: 0,
          piecesInTransit: 0,
          piecesAtSuppliers: 0,
          lossCostTotal: 0,
          divergenceRate: 0,
          demobilizingWorks: 0,
          pendingLoads: 0,
          delayedLoads: 0,
          mobilizedAreaM2: 0,
          demobilizedAreaM2: 0,
        },
        topLossRanking: [],
      }
    }

    try {
      // 1. Try calling the aggregate RPC
      const { data, error } = await supabase.rpc('fn_get_admin_dashboard_kpis', {
        p_period_start: filters?.dateRange?.start || null,
        p_period_end: filters?.dateRange?.end || null,
        p_work_id: filters?.workId || null,
        p_supplier_id: filters?.supplierId || null,
      })

      if (!error && data) {
        return {
          metrics: {
            totalMobilizedPieces: Number(data.totalMobilizedPieces || 0),
            completedWorks: Number(data.completedWorks || 0),
            loadsPerDay: Number(data.loadsPerDay || 0),
            piecesAtWorks: Number(data.piecesAtWorks || 0),
            totalPallets: Number(data.totalPallets || 0),
            piecesInTransit: Number(data.piecesInTransit || 0),
            piecesAtSuppliers: Number(data.piecesAtSuppliers || 0),
            lossCostTotal: Number(data.lossCostTotal || 0),
            divergenceRate: Number(data.divergenceRate || 0),
            demobilizingWorks: Number(data.demobilizingWorks || 0),
            pendingLoads: Number(data.pendingLoads || 0),
            delayedLoads: Number(data.delayedLoads || 0),
            mobilizedAreaM2: Number(data.mobilizedAreaM2 || 0),
            demobilizedAreaM2: Number(data.demobilizedAreaM2 || 0),
          },
          topLossRanking: data.topLossRanking || [],
        }
      }

      // Fallback query directly on tables if RPC not available
      const [
        { count: completedWorks },
        { count: demobWorks },
        { data: stockData },
        { data: transitData },
        { count: totalPallets },
        { count: pendingLoads },
        { data: delayedLoadsData },
        { data: lossesData },
        { count: divCount },
        { count: confItemCount },
        { data: mobData },
        { data: demobData },
      ] = await Promise.all([
        supabase.from('works').select('*', { count: 'exact', head: true }).eq('status', 'CONCLUIDA'),
        supabase.from('demobilizations').select('work_id', { count: 'exact', head: true }).in('status', ['PLANEJADA', 'EM_ANDAMENTO']),
        supabase.from('stock_balances').select('quantity, bucket, locations!location_id(type)'),
        supabase.from('stock_in_transit_balances').select('quantity'),
        supabase.from('demobilization_pallets').select('*', { count: 'exact', head: true }),
        supabase.from('loads').select('*', { count: 'exact', head: true }).in('status', ['RASCUNHO', 'PRONTA_PARA_ENVIO']),
        supabase.from('loads').select('id').lt('expected_arrival_date', new Date().toISOString().split('T')[0]).in('status', ['DESPACHADA', 'EM_TRANSITO']),
        supabase.from('losses').select('calculated_value'),
        supabase.from('divergences').select('*', { count: 'exact', head: true }),
        supabase.from('pallet_conference_items').select('*', { count: 'exact', head: true }),
        supabase.from('mobilization_items').select('quantity, materials!material_id(unit_area_m2)'),
        supabase.from('demobilization_pallet_items').select('quantity, materials!material_id(unit_area_m2)'),
      ])

      let piecesAtWorks = 0
      let piecesAtSuppliers = 0
      stockData?.forEach((row: any) => {
        const qty = Number(row.quantity || 0)
        if (row.locations?.type === 'OBRA') piecesAtWorks += qty
        if (row.locations?.type === 'FORNECEDOR') piecesAtSuppliers += qty
      })

      const piecesInTransit = (transitData || []).reduce((acc, r) => acc + Number(r.quantity || 0), 0)
      const lossCostTotal = (lossesData || []).reduce((acc, r) => acc + Number(r.calculated_value || 0), 0)

      let mobPieces = 0
      let mobArea = 0
      mobData?.forEach((row: any) => {
        const q = Number(row.quantity || 0)
        mobPieces += q
        mobArea += q * Number(row.materials?.unit_area_m2 || 0)
      })

      let demobArea = 0
      demobData?.forEach((row: any) => {
        const q = Number(row.quantity || 0)
        demobArea += q * Number(row.materials?.unit_area_m2 || 0)
      })

      const divergenceRate = (confItemCount || 0) > 0 ? Number((((divCount || 0) / (confItemCount || 1)) * 100).toFixed(2)) : 0

      return {
        metrics: {
          totalMobilizedPieces: mobPieces,
          completedWorks: completedWorks || 0,
          loadsPerDay: 0,
          piecesAtWorks,
          totalPallets: totalPallets || 0,
          piecesInTransit,
          piecesAtSuppliers,
          lossCostTotal,
          divergenceRate,
          demobilizingWorks: demobWorks || 0,
          pendingLoads: pendingLoads || 0,
          delayedLoads: delayedLoadsData?.length || 0,
          mobilizedAreaM2: mobArea,
          demobilizedAreaM2: demobArea,
        },
        topLossRanking: [],
      }
    } catch (err) {
      console.warn('Dashboard metrics fetch fallback error:', err)
      return {
        metrics: {
          totalMobilizedPieces: 0,
          completedWorks: 0,
          loadsPerDay: 0,
          piecesAtWorks: 0,
          totalPallets: 0,
          piecesInTransit: 0,
          piecesAtSuppliers: 0,
          lossCostTotal: 0,
          divergenceRate: 0,
          demobilizingWorks: 0,
          pendingLoads: 0,
          delayedLoads: 0,
          mobilizedAreaM2: 0,
          demobilizedAreaM2: 0,
        },
        topLossRanking: [],
      }
    }
  },

  async getWorkDashboardMetrics(workId: string): Promise<WorkDashboardMetrics> {
    if (!isSupabaseConfigured) {
      return {
        workId,
        workCode: 'OBRA',
        workName: 'Obra',
        currentStockPieces: 0,
        currentStockAreaM2: 0,
        availablePieces: 0,
        reservedPieces: 0,
        totalMobilizedPieces: 0,
        totalDemobilizedPieces: 0,
        sentLoadsCount: 0,
        receivedLoadsCount: 0,
        totalPallets: 0,
        sentPieces: 0,
        sentAreaM2: 0,
        divergencesCount: 0,
        lossesValue: 0,
        pendingLoadsCount: 0,
        delayedLoadsCount: 0,
      }
    }

    const [
      { data: locData },
      { data: stockData },
      { data: mobData },
      { data: demobPalletData },
      { data: loadsSentData },
      { data: loadsRecvData },
      { data: divData },
      { data: lossData },
    ] = await Promise.all([
      supabase.from('locations').select('id, code, name').eq('id', workId).single(),
      supabase.from('stock_balances').select('quantity, bucket, materials!material_id(unit_area_m2)').eq('location_id', workId),
      supabase.from('mobilizations').select('id, mobilization_items:mobilization_pallets(mobilization_items(quantity, materials!material_id(unit_area_m2)))').eq('destination_work_id', workId),
      supabase.from('demobilization_pallets').select('id, status, demobilization_pallet_items(quantity, materials!material_id(unit_area_m2))').eq('origin_location_id', workId),
      supabase.from('loads').select('id, status, expected_arrival_date').eq('origin_location_id', workId),
      supabase.from('loads').select('id, status').eq('destination_location_id', workId),
      supabase.from('divergences').select('id').eq('work_id', workId),
      supabase.from('losses').select('calculated_value').eq('work_id', workId),
    ])

    let currentStockPieces = 0
    let currentStockAreaM2 = 0
    let availablePieces = 0
    let reservedPieces = 0

    stockData?.forEach((row: any) => {
      const q = Number(row.quantity || 0)
      const area = q * Number(row.materials?.unit_area_m2 || 0)
      currentStockPieces += q
      currentStockAreaM2 += area
      if (row.bucket === 'DISPONIVEL') availablePieces += q
      if (row.bucket === 'RESERVADO') reservedPieces += q
    })

    let totalDemobilizedPieces = 0
    let sentAreaM2 = 0
    demobPalletData?.forEach((dp: any) => {
      dp.demobilization_pallet_items?.forEach((dpi: any) => {
        const q = Number(dpi.quantity || 0)
        totalDemobilizedPieces += q
        sentAreaM2 += q * Number(dpi.materials?.unit_area_m2 || 0)
      })
    })

    const pendingLoadsCount = (loadsSentData || []).filter(l => ['RASCUNHO', 'PRONTA_PARA_ENVIO'].includes(l.status)).length
    const today = new Date().toISOString().split('T')[0]
    const delayedLoadsCount = (loadsSentData || []).filter(l => l.expected_arrival_date && l.expected_arrival_date < today && ['DESPACHADA', 'EM_TRANSITO'].includes(l.status)).length
    const lossesValue = (lossData || []).reduce((acc, r) => acc + Number(r.calculated_value || 0), 0)

    return {
      workId,
      workCode: locData?.code || 'OBRA',
      workName: locData?.name || 'Obra',
      currentStockPieces,
      currentStockAreaM2,
      availablePieces,
      reservedPieces,
      totalMobilizedPieces: 0,
      totalDemobilizedPieces,
      sentLoadsCount: loadsSentData?.length || 0,
      receivedLoadsCount: loadsRecvData?.length || 0,
      totalPallets: demobPalletData?.length || 0,
      sentPieces: totalDemobilizedPieces,
      sentAreaM2,
      divergencesCount: divData?.length || 0,
      lossesValue,
      pendingLoadsCount,
      delayedLoadsCount,
    }
  },

  async getSupplierDashboardMetrics(supplierId: string): Promise<SupplierDashboardMetrics> {
    if (!isSupabaseConfigured) {
      return {
        supplierId,
        supplierCode: 'FORN',
        supplierName: 'Fornecedor',
        receivedLoadsCount: 0,
        receivedPalletsCount: 0,
        receivedPiecesCount: 0,
        receivedAreaM2: 0,
        loadsPerDay: 0,
        piecesPerDay: 0,
        worksServedCount: 0,
        divergencesCount: 0,
        awaitingClassificationPieces: 0,
        reusablePieces: 0,
        scrapPieces: 0,
        totalServiceCost: 0,
        pendingCostCount: 0,
      }
    }

    const [
      { data: locData },
      { data: stockData },
      { data: loadsRecvData },
      { data: divData },
      { data: costData },
    ] = await Promise.all([
      supabase.from('locations').select('id, code, name').eq('id', supplierId).single(),
      supabase.from('stock_balances').select('quantity, bucket').eq('location_id', supplierId),
      supabase.from('loads').select('id, origin_location_id, status, created_at').eq('destination_location_id', supplierId).in('status', ['RECEBIDA', 'CONFERIDA', 'FINALIZADA']),
      supabase.from('divergences').select('id').eq('supplier_id', supplierId),
      supabase.from('supplier_service_costs').select('calculated_value, status, received_area_m2').eq('supplier_id', supplierId),
    ])

    let awaitingClassificationPieces = 0
    let reusablePieces = 0
    let scrapPieces = 0

    stockData?.forEach((row: any) => {
      const q = Number(row.quantity || 0)
      if (row.bucket === 'AGUARDANDO_CLASSIFICACAO') awaitingClassificationPieces += q
      if (row.bucket === 'REAPROVEITAVEL' || row.bucket === 'DISPONIVEL') reusablePieces += q
      if (row.bucket === 'SUCATA') scrapPieces += q
    })

    const worksServed = new Set((loadsRecvData || []).map(l => l.origin_location_id)).size
    let totalServiceCost = 0
    let pendingCostCount = 0
    let receivedAreaM2 = 0

    costData?.forEach((c: any) => {
      receivedAreaM2 += Number(c.received_area_m2 || 0)
      if (c.status === 'CALCULADO') {
        totalServiceCost += Number(c.calculated_value || 0)
      } else if (c.status === 'PENDENTE_DE_TAXA') {
        pendingCostCount += 1
      }
    })

    return {
      supplierId,
      supplierCode: locData?.code || 'FORN',
      supplierName: locData?.name || 'Fornecedor',
      receivedLoadsCount: loadsRecvData?.length || 0,
      receivedPalletsCount: 0,
      receivedPiecesCount: 0,
      receivedAreaM2,
      loadsPerDay: 0,
      piecesPerDay: 0,
      worksServedCount: worksServed,
      divergencesCount: divData?.length || 0,
      awaitingClassificationPieces,
      reusablePieces,
      scrapPieces,
      totalServiceCost,
      pendingCostCount,
    }
  },

  async getWarehouseDashboardMetrics(warehouseId: string): Promise<WarehouseDashboardMetrics> {
    if (!isSupabaseConfigured) {
      return {
        warehouseId,
        warehouseCode: 'GALPAO',
        warehouseName: 'Galpão Central',
        currentStockPieces: 0,
        availablePieces: 0,
        reusablePieces: 0,
        scrapPieces: 0,
        receivedLoadsCount: 0,
        dispatchedLoadsCount: 0,
        totalPallets: 0,
        recentMovementsCount: 0,
      }
    }

    const [
      { data: locData },
      { data: stockData },
      { data: loadsRecvData },
      { data: loadsSentData },
      { count: movCount },
    ] = await Promise.all([
      supabase.from('locations').select('id, code, name').eq('id', warehouseId).single(),
      supabase.from('stock_balances').select('quantity, bucket').eq('location_id', warehouseId),
      supabase.from('loads').select('id').eq('destination_location_id', warehouseId),
      supabase.from('loads').select('id').eq('origin_location_id', warehouseId),
      supabase.from('stock_movements').select('*', { count: 'exact', head: true }).or(`origin_location_id.eq.${warehouseId},destination_location_id.eq.${warehouseId}`),
    ])

    let currentStockPieces = 0
    let availablePieces = 0
    let reusablePieces = 0
    let scrapPieces = 0

    stockData?.forEach((row: any) => {
      const q = Number(row.quantity || 0)
      currentStockPieces += q
      if (row.bucket === 'DISPONIVEL') availablePieces += q
      if (row.bucket === 'REAPROVEITAVEL') reusablePieces += q
      if (row.bucket === 'SUCATA') scrapPieces += q
    })

    return {
      warehouseId,
      warehouseCode: locData?.code || 'GALPAO',
      warehouseName: locData?.name || 'Galpão Central',
      currentStockPieces,
      availablePieces,
      reusablePieces,
      scrapPieces,
      receivedLoadsCount: loadsRecvData?.length || 0,
      dispatchedLoadsCount: loadsSentData?.length || 0,
      totalPallets: 0,
      recentMovementsCount: movCount || 0,
    }
  },
}
