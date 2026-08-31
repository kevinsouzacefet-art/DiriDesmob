import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Profile, UserWithLocations, UserSystemRole } from '../types'

const fallbackUsers: UserWithLocations[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@diridesmob.com.br',
    full_name: 'Dr. Carlos Mendes',
    system_role: 'ADMINISTRADOR',
    phone: '(11) 98888-7777',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'analista@diridesmob.com.br',
    full_name: 'Juliana Torres',
    system_role: 'ANALISTA',
    phone: '(11) 97777-6666',
    is_active: true,
    created_at: '2025-01-05T00:00:00Z',
    updated_at: '2025-01-05T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'obra.supervisor@diridesmob.com.br',
    full_name: 'Eng. Marcos Silveira',
    system_role: 'OBRA_SUPERVISOR',
    phone: '(11) 96666-5555',
    is_active: true,
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'obra.conferente@diridesmob.com.br',
    full_name: 'Lucas Prado',
    system_role: 'OBRA_CONFERENTE',
    phone: '(11) 95555-4444',
    is_active: true,
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'fornecedor.supervisor@formax.com.br',
    full_name: 'Roberto Vianna',
    system_role: 'FORNECEDOR_SUPERVISOR',
    phone: '(11) 94444-3333',
    is_active: true,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'galpao.conferente@diridesmob.com.br',
    full_name: 'Valdir Santos',
    system_role: 'GALPAO_CONFERENTE',
    phone: '(11) 93333-2222',
    is_active: true,
    created_at: '2025-01-20T00:00:00Z',
    updated_at: '2025-01-20T00:00:00Z',
  },
]

export const userService = {
  async listUsers(): Promise<UserWithLocations[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, location_accesses:user_location_access(location:locations(*))')
          .order('full_name', { ascending: true })

        if (!error && data && data.length > 0) {
          return data as unknown as UserWithLocations[]
        }
        if (error) {
          console.warn('Supabase listUsers error, using local fallback:', error)
        }
      } catch (err) {
        console.warn('Supabase listUsers exception, using local fallback:', err)
      }
    }

    const stored = localStorage.getItem('diridesmob_custom_users')
    const users: UserWithLocations[] = stored ? JSON.parse(stored) : fallbackUsers
    return users
  },

  async getUserLocationAccess(userId: string): Promise<string[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('user_location_access')
          .select('location_id')
          .eq('user_id', userId)

        if (!error && data) {
          return data.map(item => item.location_id)
        }
      } catch (err) {
        console.warn('Supabase getUserLocationAccess exception, using local fallback:', err)
      }
    }

    const storedAccess = localStorage.getItem('diridesmob_custom_user_access')
    const accessMap: Record<string, string[]> = storedAccess ? JSON.parse(storedAccess) : {
      '00000000-0000-0000-0000-000000000003': ['b2222222-2222-2222-2222-222222222221'],
      '00000000-0000-0000-0000-000000000004': ['b2222222-2222-2222-2222-222222222221'],
      '00000000-0000-0000-0000-000000000005': ['c3333333-3333-3333-3333-333333333331'],
      '00000000-0000-0000-0000-000000000006': ['a1111111-1111-1111-1111-111111111111'],
    }
    return accessMap[userId] || []
  },

  async setUserLocationAccess(userId: string, locationIds: string[]): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        // 1. Remove existing accesses
        await supabase
          .from('user_location_access')
          .delete()
          .eq('user_id', userId)

        // 2. Insert new accesses
        if (locationIds.length > 0) {
          const inserts = locationIds.map(location_id => ({
            user_id: userId,
            location_id,
          }))
          await supabase
            .from('user_location_access')
            .insert(inserts)
        }
      } catch (err) {
        console.warn('Supabase setUserLocationAccess error, saving locally:', err)
      }
    }

    const storedAccess = localStorage.getItem('diridesmob_custom_user_access')
    const accessMap: Record<string, string[]> = storedAccess ? JSON.parse(storedAccess) : {}
    accessMap[userId] = locationIds
    localStorage.setItem('diridesmob_custom_user_access', JSON.stringify(accessMap))
  },

  async updateUserRoleOrStatus(userId: string, updates: { system_role?: UserSystemRole; is_active?: boolean }): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      } catch (err) {
        console.warn('Supabase updateUserRoleOrStatus error, saving locally:', err)
      }
    }

    const stored = localStorage.getItem('diridesmob_custom_users')
    const list: UserWithLocations[] = stored ? JSON.parse(stored) : [...fallbackUsers]
    const index = list.findIndex(u => u.id === userId)
    if (index !== -1) {
      list[index] = {
        ...list[index],
        ...updates,
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem('diridesmob_custom_users', JSON.stringify(list))
    }
  },
}
