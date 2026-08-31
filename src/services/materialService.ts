import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Material } from '../types'

const fallbackMaterials: Material[] = [
  {
    id: 'd4444444-4444-4444-4444-444444444441',
    code: 'PAN-2400-600',
    name: 'Painel Fôrma Metálica 2400x600',
    width_mm: 600,
    height_mm: 2400,
    unit_area_m2: 1.44,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444442',
    code: 'PAN-2400-450',
    name: 'Painel Fôrma Metálica 2400x450',
    width_mm: 450,
    height_mm: 2400,
    unit_area_m2: 1.08,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444443',
    code: 'PAN-2400-300',
    name: 'Painel Fôrma Metálica 2400x300',
    width_mm: 300,
    height_mm: 2400,
    unit_area_m2: 0.72,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444444',
    code: 'PAN-1200-600',
    name: 'Painel Fôrma Metálica 1200x600',
    width_mm: 600,
    height_mm: 1200,
    unit_area_m2: 0.72,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444445',
    code: 'VIG-ALU-2400',
    name: 'Viga de Alumínio Primária 2400mm',
    width_mm: 150,
    height_mm: 2400,
    unit_area_m2: 0.36,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444446',
    code: 'ESC-MET-3500',
    name: 'Escora Telescópica Pesada 3.50m',
    width_mm: 120,
    height_mm: 3500,
    unit_area_m2: 0.42,
    unit: 'UN',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
]

export const materialService = {
  async listMaterials(activeOnly: boolean = false): Promise<Material[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_materials')
      const list: Material[] = stored ? JSON.parse(stored) : fallbackMaterials
      return activeOnly ? list.filter(m => m.is_active) : list
    }

    let query = supabase.from('materials').select('*').order('code', { ascending: true })
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching materials:', error)
      throw error
    }

    return (data || []) as Material[]
  },

  async createMaterial(payload: {
    code: string
    name: string
    width_mm: number
    height_mm: number
    unit?: string
  }): Promise<Material> {
    const unit_area_m2 = Number(((payload.width_mm / 1000) * (payload.height_mm / 1000)).toFixed(4))

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_materials')
      const list: Material[] = stored ? JSON.parse(stored) : [...fallbackMaterials]
      const newMat: Material = {
        id: crypto.randomUUID(),
        code: payload.code.toUpperCase().trim(),
        name: payload.name.trim(),
        width_mm: payload.width_mm,
        height_mm: payload.height_mm,
        unit_area_m2,
        unit: payload.unit || 'UN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      list.unshift(newMat)
      localStorage.setItem('diridesmob_custom_materials', JSON.stringify(list))
      return newMat
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        code: payload.code.toUpperCase().trim(),
        name: payload.name.trim(),
        width_mm: payload.width_mm,
        height_mm: payload.height_mm,
        unit: payload.unit || 'UN',
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data as Material
  },

  async updateMaterial(
    id: string,
    payload: {
      name?: string
      width_mm?: number
      height_mm?: number
      unit?: string
      is_active?: boolean
    }
  ): Promise<Material> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_materials')
      const list: Material[] = stored ? JSON.parse(stored) : [...fallbackMaterials]
      const index = list.findIndex(m => m.id === id)
      if (index !== -1) {
        const item = list[index]
        const width = payload.width_mm ?? item.width_mm
        const height = payload.height_mm ?? item.height_mm
        const unit_area_m2 = Number(((width / 1000) * (height / 1000)).toFixed(4))

        list[index] = {
          ...item,
          ...payload,
          unit_area_m2,
          updated_at: new Date().toISOString(),
        }
        localStorage.setItem('diridesmob_custom_materials', JSON.stringify(list))
        return list[index]
      }
      throw new Error('Material não encontrado')
    }

    const { data, error } = await supabase
      .from('materials')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Material
  },

  async toggleActive(id: string, currentStatus: boolean): Promise<Material> {
    return this.updateMaterial(id, { is_active: !currentStatus })
  },
}
