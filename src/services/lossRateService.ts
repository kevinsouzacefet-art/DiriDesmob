import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LossValuationRate, LossValuationRateWithRelations } from '../types'
import { materialService } from './materialService'
import { workService } from './workService'

const fallbackLossRates: LossValuationRate[] = [
  {
    id: 'e5555555-5555-5555-5555-555555555551',
    material_id: 'd4444444-4444-4444-4444-444444444441', // PAN-2400-600
    work_id: null, // Padrão
    rate_per_m2: 250.0,
    valid_from: '2025-01-01',
    valid_to: null,
    notes: 'Taxa padrão contratual',
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'e5555555-5555-5555-5555-555555555552',
    material_id: 'd4444444-4444-4444-4444-444444444441', // PAN-2400-600
    work_id: 'b2222222-2222-2222-2222-222222222221', // Residencial Park Towers
    rate_per_m2: 280.0,
    valid_from: '2025-01-01',
    valid_to: null,
    notes: 'Aditivo contratual específico Obra Park Towers',
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'e5555555-5555-5555-5555-555555555553',
    material_id: 'd4444444-4444-4444-4444-444444444442', // PAN-2400-450
    work_id: null, // Padrão
    rate_per_m2: 240.0,
    valid_from: '2025-01-01',
    valid_to: null,
    notes: 'Taxa padrão contratual',
    created_by: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

export const lossRateService = {
  async listLossRates(): Promise<LossValuationRateWithRelations[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_loss_rates')
      const rates: LossValuationRate[] = stored ? JSON.parse(stored) : fallbackLossRates
      const [materials, works] = await Promise.all([
        materialService.listMaterials(),
        workService.listWorks(),
      ])

      return rates.map(r => ({
        ...r,
        material: materials.find(m => m.id === r.material_id),
        work: r.work_id ? works.find(w => w.id === r.work_id) || null : null,
      }))
    }

    const { data, error } = await supabase
      .from('loss_valuation_rates')
      .select('*, material:materials(*), work:works(*, location:locations(*))')
      .order('valid_from', { ascending: false })

    if (error) {
      console.error('Error fetching loss rates:', error)
      throw error
    }

    return (data || []) as unknown as LossValuationRateWithRelations[]
  },

  /**
   * Resolves the active loss valuation rate per m² according to the approved business rules:
   * 1. Try specific rate for (material_id + work_id) for the target date.
   * 2. Fallback to default rate for (material_id + work_id IS NULL) for the target date.
   * 3. Return null if none exists (caller must block loss creation).
   */
  async getActiveRate(
    materialId: string,
    workId?: string | null,
    dateStr?: string
  ): Promise<number | null> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0]

    if (!isSupabaseConfigured) {
      const rates = await this.listLossRates()

      // 1. Check specific work rate
      if (workId) {
        const specificMatch = rates.find(r => {
          const isMaterial = r.material_id === materialId
          const isWork = r.work_id === workId
          const afterFrom = r.valid_from <= targetDate
          const beforeTo = !r.valid_to || r.valid_to >= targetDate
          return isMaterial && isWork && afterFrom && beforeTo
        })
        if (specificMatch) return specificMatch.rate_per_m2
      }

      // 2. Check default material rate (work_id is null)
      const defaultMatch = rates.find(r => {
        const isMaterial = r.material_id === materialId
        const isDefault = r.work_id === null || r.work_id === undefined
        const afterFrom = r.valid_from <= targetDate
        const beforeTo = !r.valid_to || r.valid_to >= targetDate
        return isMaterial && isDefault && afterFrom && beforeTo
      })

      if (defaultMatch) return defaultMatch.rate_per_m2

      // 3. No rate registered
      return null
    }

    // Direct database RPC or query
    // 1. Try specific work rate
    if (workId) {
      const { data: specificData } = await supabase
        .from('loss_valuation_rates')
        .select('rate_per_m2')
        .eq('material_id', materialId)
        .eq('work_id', workId)
        .lte('valid_from', targetDate)
        .or(`valid_to.is.null,valid_to.gte.${targetDate}`)
        .order('valid_from', { ascending: false })
        .limit(1)

      if (specificData && specificData.length > 0) {
        return specificData[0].rate_per_m2
      }
    }

    // 2. Fallback to default material rate
    const { data: defaultData, error } = await supabase
      .from('loss_valuation_rates')
      .select('rate_per_m2')
      .eq('material_id', materialId)
      .is('work_id', null)
      .lte('valid_from', targetDate)
      .or(`valid_to.is.null,valid_to.gte.${targetDate}`)
      .order('valid_from', { ascending: false })
      .limit(1)

    if (error || !defaultData || defaultData.length === 0) {
      return null
    }

    return defaultData[0].rate_per_m2
  },

  /**
   * Helper that throws a descriptive error if rate is missing
   */
  async requireActiveRate(
    materialId: string,
    materialCode: string,
    workId?: string | null,
    workName?: string | null,
    dateStr?: string
  ): Promise<number> {
    const rate = await this.getActiveRate(materialId, workId, dateStr)
    if (rate === null || rate === undefined) {
      const workContext = workName ? ` para a obra "${workName}"` : ''
      throw new Error(
        `Taxa de valoração de perda não cadastrada para o material "${materialCode}"${workContext} na data informada. É necessário cadastrar a taxa padrão ou específica antes de apurar a perda.`
      )
    }
    return rate
  },

  async createLossRate(payload: {
    material_id: string
    work_id?: string | null
    rate_per_m2: number
    valid_from: string
    valid_to?: string | null
    notes?: string
  }): Promise<LossValuationRate> {
    if (payload.rate_per_m2 < 0) {
      throw new Error('O valor da taxa por m² não pode ser negativo.')
    }

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_loss_rates')
      const rates: LossValuationRate[] = stored ? JSON.parse(stored) : [...fallbackLossRates]
      const newRate: LossValuationRate = {
        id: crypto.randomUUID(),
        material_id: payload.material_id,
        work_id: payload.work_id || null,
        rate_per_m2: payload.rate_per_m2,
        valid_from: payload.valid_from,
        valid_to: payload.valid_to || null,
        notes: payload.notes || null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      rates.unshift(newRate)
      localStorage.setItem('diridesmob_custom_loss_rates', JSON.stringify(rates))
      return newRate
    }

    const { data, error } = await supabase
      .from('loss_valuation_rates')
      .insert({
        material_id: payload.material_id,
        work_id: payload.work_id || null,
        rate_per_m2: payload.rate_per_m2,
        valid_from: payload.valid_from,
        valid_to: payload.valid_to || null,
        notes: payload.notes || null,
      })
      .select()
      .single()

    if (error) throw error
    return data as LossValuationRate
  },

  /**
   * Closes an existing rate's validity period (encerrar vigência anterior)
   */
  async closeRateValidity(id: string, validToDate: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_loss_rates')
      const rates: LossValuationRate[] = stored ? JSON.parse(stored) : [...fallbackLossRates]
      const index = rates.findIndex(r => r.id === id)
      if (index !== -1) {
        rates[index].valid_to = validToDate
        rates[index].updated_at = new Date().toISOString()
        localStorage.setItem('diridesmob_custom_loss_rates', JSON.stringify(rates))
      }
      return
    }

    const { error } = await supabase
      .from('loss_valuation_rates')
      .update({
        valid_to: validToDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  },
}
