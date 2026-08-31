import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { SupplierWithLocation } from '../types'
import { locationService } from './locationService'

export const supplierService = {
  async listSuppliers(): Promise<SupplierWithLocation[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*, location:locations(*)')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          return (data || []) as unknown as SupplierWithLocation[]
        }
        if (error) {
          console.warn('Supabase suppliers fetch failed, fallback to local location suppliers:', error.message)
        }
      } catch (err) {
        console.warn('Supabase suppliers exception, fallback to local location suppliers:', err)
      }
    }

    const locations = await locationService.listLocations('FORNECEDOR')
    const storedSuppliers = localStorage.getItem('diridesmob_custom_suppliers')
    const suppliersMap = storedSuppliers ? JSON.parse(storedSuppliers) : {}

    return locations.map(loc => {
      const extra = suppliersMap[loc.id] || {
        cnpj: loc.code === 'FORN-FORMAX' ? '12.345.678/0001-90' : '98.765.432/0001-10',
        contact_name: loc.code === 'FORN-FORMAX' ? 'Roberto Vianna' : 'Helena Ramos',
        contact_phone: loc.code === 'FORN-FORMAX' ? '(11) 98765-4321' : '(31) 99123-4567',
        contact_email: loc.code === 'FORN-FORMAX' ? 'roberto.vianna@formax.com.br' : 'h.ramos@aluform.ind.br',
        is_active: loc.is_active,
        created_at: loc.created_at,
        updated_at: loc.updated_at,
      }
      return {
        id: loc.id,
        cnpj: extra.cnpj,
        contact_name: extra.contact_name,
        contact_phone: extra.contact_phone,
        contact_email: extra.contact_email,
        is_active: extra.is_active,
        created_at: extra.created_at,
        updated_at: extra.updated_at,
        location: loc,
      }
    })
  },

  async createSupplier(payload: {
    code: string
    name: string
    address?: string
    city?: string
    state?: string
    postal_code?: string
    cnpj?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
  }): Promise<SupplierWithLocation> {
    const location = await locationService.createLocation({
      code: payload.code,
      name: payload.name,
      type: 'FORNECEDOR',
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postal_code,
    })

    if (!isSupabaseConfigured) {
      const storedSuppliers = localStorage.getItem('diridesmob_custom_suppliers')
      const suppliersMap = storedSuppliers ? JSON.parse(storedSuppliers) : {}
      const supplierData = {
        id: location.id,
        cnpj: payload.cnpj || null,
        contact_name: payload.contact_name || null,
        contact_phone: payload.contact_phone || null,
        contact_email: payload.contact_email || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      suppliersMap[location.id] = supplierData
      localStorage.setItem('diridesmob_custom_suppliers', JSON.stringify(suppliersMap))
      return {
        ...supplierData,
        location,
      }
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        id: location.id,
        cnpj: payload.cnpj || null,
        contact_name: payload.contact_name || null,
        contact_phone: payload.contact_phone || null,
        contact_email: payload.contact_email || null,
        is_active: true,
      })
      .select('*, location:locations(*)')
      .single()

    if (error) throw error
    return data as unknown as SupplierWithLocation
  },

  async updateSupplier(
    id: string,
    payload: {
      name?: string
      city?: string
      state?: string
      cnpj?: string
      contact_name?: string
      contact_phone?: string
      contact_email?: string
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

    if (!isSupabaseConfigured) {
      const storedSuppliers = localStorage.getItem('diridesmob_custom_suppliers')
      const suppliersMap = storedSuppliers ? JSON.parse(storedSuppliers) : {}
      if (suppliersMap[id]) {
        suppliersMap[id] = {
          ...suppliersMap[id],
          ...payload,
          updated_at: new Date().toISOString(),
        }
        localStorage.setItem('diridesmob_custom_suppliers', JSON.stringify(suppliersMap))
      }
      return
    }

    const { error } = await supabase
      .from('suppliers')
      .update({
        cnpj: payload.cnpj,
        contact_name: payload.contact_name,
        contact_phone: payload.contact_phone,
        contact_email: payload.contact_email,
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
  },
}
