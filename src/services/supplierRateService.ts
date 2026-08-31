import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { SupplierServiceRate, SupplierServiceCost } from '../types'

export interface CreateSupplierRateInput {
  supplier_id: string
  rate_per_m2: number
  valid_from: string
  valid_to?: string | null
}

export const supplierRateService = {
  async listRates(supplierId?: string): Promise<(SupplierServiceRate & { supplier?: any })[]> {
    if (!isSupabaseConfigured) {
      return []
    }

    let query = supabase
      .from('supplier_service_rates')
      .select('*, supplier:locations!supplier_id(id, code, name)')
      .order('valid_from', { ascending: false })

    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async createRate(input: CreateSupplierRateInput): Promise<SupplierServiceRate> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não está configurado.')
    }

    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('supplier_service_rates')
      .insert({
        supplier_id: input.supplier_id,
        rate_per_m2: input.rate_per_m2,
        valid_from: input.valid_from,
        valid_to: input.valid_to || null,
        created_by: userData?.user?.id || null,
      })
      .select()
      .single()

    if (error) {
      if (error.message?.includes('Conflito de vigência') || error.message?.includes('chk_supplier_rate_dates')) {
        throw new Error(error.message)
      }
      throw error
    }

    // Trigger recalculation of pending costs for this supplier
    try {
      await supabase.rpc('fn_recalculate_pending_supplier_service_costs', {
        p_supplier_id: input.supplier_id,
      })
    } catch (e) {
      console.warn('Could not auto-trigger recalculation of pending supplier costs:', e)
    }

    return data
  },

  async closeRatePeriod(rateId: string, validToDate: string): Promise<SupplierServiceRate> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não está configurado.')
    }

    const { data, error } = await supabase
      .from('supplier_service_rates')
      .update({ valid_to: validToDate })
      .eq('id', rateId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async listServiceCosts(filters?: {
    supplierId?: string
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<(SupplierServiceCost & { supplier?: any; load?: any; conference?: any })[]> {
    if (!isSupabaseConfigured) {
      return []
    }

    let query = supabase
      .from('supplier_service_costs')
      .select(`
        *,
        supplier:locations!supplier_id(id, code, name),
        load:loads!load_id(id, load_number, status, plate_number),
        conference:load_conferences!conference_id(id, started_at, finished_at, status)
      `)
      .order('service_date', { ascending: false })

    if (filters?.supplierId) {
      query = query.eq('supplier_id', filters.supplierId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.startDate) {
      query = query.gte('service_date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('service_date', filters.endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async recalculatePending(supplierId: string): Promise<{ recalculated_count: number }> {
    if (!isSupabaseConfigured) {
      return { recalculated_count: 0 }
    }

    const { data, error } = await supabase.rpc('fn_recalculate_pending_supplier_service_costs', {
      p_supplier_id: supplierId,
    })

    if (error) throw error
    return data as any
  },
}
