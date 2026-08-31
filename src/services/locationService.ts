import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Location, LocationType } from '../types'

// In-memory fallback if Supabase table is empty or before initial sync
const fallbackLocations: Location[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    code: 'GALP-CENTRAL',
    name: 'Galpão Central de Distribuição SP',
    type: 'GALPAO',
    address: 'Av. Industrial, 1500 - Distrito Industrial',
    city: 'Barueri',
    state: 'SP',
    postal_code: '06455-000',
    is_active: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'b2222222-2222-2222-2222-222222222221',
    code: 'OBRA-RES-PARK',
    name: 'Residencial Park Towers',
    type: 'OBRA',
    address: 'Rua das Palmeiras, 300 - Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01310-200',
    is_active: true,
    created_at: '2025-01-12T08:00:00Z',
    updated_at: '2025-01-12T08:00:00Z',
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    code: 'OBRA-CORP-HORIZON',
    name: 'Complexo Corporativo Horizon',
    type: 'OBRA',
    address: 'Av. das Nações Unidas, 12000 - Brooklin',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '04795-100',
    is_active: true,
    created_at: '2025-02-01T08:00:00Z',
    updated_at: '2025-02-01T08:00:00Z',
  },
  {
    id: 'c3333333-3333-3333-3333-333333333331',
    code: 'FORN-FORMAX',
    name: 'Formax Soluções em Fôrmas Metálicas',
    type: 'FORNECEDOR',
    address: 'Rodovia dos Bandeirantes, km 42',
    city: 'Cajamar',
    state: 'SP',
    postal_code: '07750-000',
    is_active: true,
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
  {
    id: 'c3333333-3333-3333-3333-333333333332',
    code: 'FORN-ALUFORM',
    name: 'Aluform Sistemas de Alumínio e Escoramento',
    type: 'FORNECEDOR',
    address: 'Av. das Indústrias, 850',
    city: 'Betim',
    state: 'MG',
    postal_code: '32600-000',
    is_active: true,
    created_at: '2025-01-20T08:00:00Z',
    updated_at: '2025-01-20T08:00:00Z',
  },
]

export const locationService = {
  async getLocations(typeFilter?: LocationType): Promise<Location[]> {
    return this.listLocations(typeFilter)
  },

  async listLocations(typeFilter?: LocationType): Promise<Location[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('locations').select('*').order('name', { ascending: true })
        if (typeFilter) {
          query = query.eq('type', typeFilter)
        }

        const { data, error } = await query
        if (!error && data && data.length > 0) {
          return data as Location[]
        }
        if (error) {
          console.warn('Supabase fetch locations error, using local fallback:', error)
        }
      } catch (err) {
        console.warn('Supabase fetch locations exception, using local fallback:', err)
      }
    }

    const stored = localStorage.getItem('diridesmob_custom_locations')
    const list = stored ? JSON.parse(stored) : fallbackLocations
    return typeFilter ? list.filter((l: Location) => l.type === typeFilter) : list
  },

  async createLocation(payload: {
    code: string
    name: string
    type: LocationType
    address?: string
    city?: string
    state?: string
    postal_code?: string
  }): Promise<Location> {
    const localNewLoc: Location = {
      id: crypto.randomUUID(),
      code: payload.code.toUpperCase().trim(),
      name: payload.name.trim(),
      type: payload.type,
      address: payload.address || null,
      city: payload.city || null,
      state: payload.state ? payload.state.toUpperCase() : null,
      postal_code: payload.postal_code || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('locations')
          .insert({
            code: payload.code.toUpperCase().trim(),
            name: payload.name.trim(),
            type: payload.type,
            address: payload.address || null,
            city: payload.city || null,
            state: payload.state ? payload.state.toUpperCase() : null,
            postal_code: payload.postal_code || null,
            is_active: true,
          })
          .select()
          .single()

        if (!error && data) {
          return data as Location
        }
        console.warn('Supabase createLocation error, persisting locally:', error)
      } catch (err) {
        console.warn('Supabase createLocation exception, persisting locally:', err)
      }
    }

    const stored = localStorage.getItem('diridesmob_custom_locations')
    const list = stored ? JSON.parse(stored) : [...fallbackLocations]
    list.unshift(localNewLoc)
    localStorage.setItem('diridesmob_custom_locations', JSON.stringify(list))
    return localNewLoc
  },

  async updateLocation(
    id: string,
    payload: {
      name?: string
      address?: string
      city?: string
      state?: string
      postal_code?: string
      is_active?: boolean
    }
  ): Promise<Location> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('locations')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()

        if (!error && data) {
          return data as Location
        }
        console.warn('Supabase updateLocation error, updating locally:', error)
      } catch (err) {
        console.warn('Supabase updateLocation exception, updating locally:', err)
      }
    }

    const stored = localStorage.getItem('diridesmob_custom_locations')
    const list: Location[] = stored ? JSON.parse(stored) : [...fallbackLocations]
    const index = list.findIndex(l => l.id === id)
    if (index !== -1) {
      list[index] = {
        ...list[index],
        ...payload,
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem('diridesmob_custom_locations', JSON.stringify(list))
      return list[index]
    }
    const fallbackItem = fallbackLocations.find(l => l.id === id)
    if (fallbackItem) {
      const updated = { ...fallbackItem, ...payload, updated_at: new Date().toISOString() }
      list.push(updated)
      localStorage.setItem('diridesmob_custom_locations', JSON.stringify(list))
      return updated
    }
    throw new Error('Localização não encontrada')
  },

  async toggleActive(id: string, currentStatus: boolean): Promise<Location> {
    return this.updateLocation(id, { is_active: !currentStatus })
  },
}
