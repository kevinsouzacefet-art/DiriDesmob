import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { StockBalanceWithDetails, StockMovement, Location, Material } from '../types'
import { locationService } from './locationService'
import { materialService } from './materialService'

let localStockBalances: StockBalanceWithDetails[] = []
let localStockMovements: StockMovement[] = []

export const stockService = {
  /**
   * Retrieves stock balances with detailed material and location information
   */
  async getStockBalances(
    locationId?: string,
    materialSearch?: string
  ): Promise<StockBalanceWithDetails[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('stock_balances')
        .select(`
          *,
          material:materials(*),
          location:locations(*)
        `)
        .order('quantity', { ascending: false })

      if (locationId && locationId !== 'all') {
        query = query.eq('location_id', locationId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar saldos de estoque:', error)
        return this.filterLocalBalances(locationId, materialSearch)
      }

      let balances = (data || []) as unknown as StockBalanceWithDetails[]

      if (materialSearch && materialSearch.trim() !== '') {
        const search = materialSearch.toLowerCase().trim()
        balances = balances.filter(
          (b) =>
            b.material?.code.toLowerCase().includes(search) ||
            b.material?.name.toLowerCase().includes(search)
        )
      }

      return balances
    }

    return this.filterLocalBalances(locationId, materialSearch)
  },

  /**
   * Helper to filter local fallback balances
   */
  async filterLocalBalances(
    locationId?: string,
    materialSearch?: string
  ): Promise<StockBalanceWithDetails[]> {
    let balances = [...localStockBalances]

    if (locationId && locationId !== 'all') {
      balances = balances.filter((b) => b.location_id === locationId)
    }

    if (materialSearch && materialSearch.trim() !== '') {
      const search = materialSearch.toLowerCase().trim()
      balances = balances.filter(
        (b) =>
          b.material?.code.toLowerCase().includes(search) ||
          b.material?.name.toLowerCase().includes(search)
      )
    }

    return balances
  },

  /**
   * Retrieves stock movements (immutable ledger)
   */
  async getStockMovements(locationId?: string, limit: number = 50): Promise<StockMovement[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (locationId && locationId !== 'all') {
        query = query.or(
          `destination_location_id.eq.${locationId},origin_location_id.eq.${locationId}`
        )
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar extrato do ledger:', error)
        return localStockMovements.slice(0, limit)
      }

      return data || []
    }

    return localStockMovements.slice(0, limit)
  },

  /**
   * Retrieves segregated stock in transit
   */
  async getStockInTransit(filters?: {
    loadId?: string
    originLocationId?: string
    destinationLocationId?: string
  }) {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('stock_in_transit_balances')
        .select(`
          *,
          material:materials(*),
          origin_location:locations!stock_in_transit_balances_origin_location_id_fkey(*),
          destination_location:locations!stock_in_transit_balances_destination_location_id_fkey(*),
          load:loads(*)
        `)
        .order('created_at', { ascending: false })

      if (filters?.loadId) query = query.eq('load_id', filters.loadId)
      if (filters?.originLocationId) query = query.eq('origin_location_id', filters.originLocationId)
      if (filters?.destinationLocationId) query = query.eq('destination_location_id', filters.destinationLocationId)

      const { data, error } = await query
      if (error) {
        console.error('Erro ao buscar estoque em trânsito:', error)
        return []
      }
      return data || []
    }
    return []
  },
}
