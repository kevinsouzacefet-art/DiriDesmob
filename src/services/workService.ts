import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { WorkWithLocation, WorkStatus } from '../types'
import { locationService } from './locationService'

export const workService = {
  async listWorks(): Promise<WorkWithLocation[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('works')
          .select('*, location:locations(*)')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          return data as unknown as WorkWithLocation[]
        }
        if (error) {
          console.warn('Supabase listWorks error, using local fallback:', error)
        }
      } catch (err) {
        console.warn('Supabase listWorks exception, using local fallback:', err)
      }
    }

    const locations = await locationService.listLocations('OBRA')
    const storedWorks = localStorage.getItem('diridesmob_custom_works')
    const worksMap = storedWorks ? JSON.parse(storedWorks) : {}

    return locations.map(loc => {
      const extra = worksMap[loc.id] || {
        status: 'EM_ANDAMENTO' as WorkStatus,
        manager_name: 'Eng. Responsável',
        notes: null,
        created_at: loc.created_at,
        updated_at: loc.updated_at,
      }
      return {
        id: loc.id,
        status: extra.status,
        manager_name: extra.manager_name,
        notes: extra.notes,
        created_at: extra.created_at,
        updated_at: extra.updated_at,
        location: loc,
      }
    })
  },

  async createWork(payload: {
    code: string
    name: string
    address?: string
    city?: string
    state?: string
    postal_code?: string
    status: WorkStatus
    manager_name?: string
    notes?: string
  }): Promise<WorkWithLocation> {
    const location = await locationService.createLocation({
      code: payload.code,
      name: payload.name,
      type: 'OBRA',
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postal_code,
    })

    const workData = {
      id: location.id,
      status: payload.status,
      manager_name: payload.manager_name || null,
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('works')
          .insert({
            id: location.id,
            status: payload.status,
            manager_name: payload.manager_name || null,
            notes: payload.notes || null,
          })
          .select('*, location:locations(*)')
          .single()

        if (!error && data) {
          return data as unknown as WorkWithLocation
        }
        console.warn('Supabase createWork error, saving locally:', error)
      } catch (err) {
        console.warn('Supabase createWork exception, saving locally:', err)
      }
    }

    const storedWorks = localStorage.getItem('diridesmob_custom_works')
    const worksMap = storedWorks ? JSON.parse(storedWorks) : {}
    worksMap[location.id] = workData
    localStorage.setItem('diridesmob_custom_works', JSON.stringify(worksMap))
    return {
      ...workData,
      location,
    }
  },

  async updateWork(
    id: string,
    payload: {
      name?: string
      city?: string
      state?: string
      status?: WorkStatus
      manager_name?: string
      notes?: string
      is_active?: boolean
    }
  ): Promise<void> {
    if (payload.name !== undefined || payload.city !== undefined || payload.state !== undefined || payload.is_active !== undefined) {
      await locationService.updateLocation(id, {
        name: payload.name,
        city: payload.city,
        state: payload.state,
        is_active: payload.is_active,
      })
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('works')
          .update({
            status: payload.status,
            manager_name: payload.manager_name,
            notes: payload.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (!error) return
        console.warn('Supabase updateWork error, updating locally:', error)
      } catch (err) {
        console.warn('Supabase updateWork exception, updating locally:', err)
      }
    }

    const storedWorks = localStorage.getItem('diridesmob_custom_works')
    const worksMap = storedWorks ? JSON.parse(storedWorks) : {}
    if (worksMap[id] || true) {
      worksMap[id] = {
        ...(worksMap[id] || {}),
        ...payload,
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem('diridesmob_custom_works', JSON.stringify(worksMap))
    }
  },
}
