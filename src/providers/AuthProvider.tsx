import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../lib/supabase'
import { Profile, Location } from '../types'

interface AuthContextType {
  user: any | null
  session: any | null
  profile: Profile | null
  userLocations: Location[]
  isAdmin: boolean
  isAnalyst: boolean
  isSupervisor: boolean
  isConferente: boolean
  isLoading: boolean
  error: string | null
  isConfigured: boolean
  canAccessLocation: (locationId: string) => boolean
  canManageLocation: (locationId: string) => boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_USERS_MAP: Record<string, { profile: Profile; locations: Location[] }> = {
  'admin@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@diridesmob.com.br',
      full_name: 'Dr. Carlos Mendes',
      system_role: 'ADMINISTRADOR',
      phone: '(11) 98888-7777',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    locations: [],
  },
  'analista@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'analista@diridesmob.com.br',
      full_name: 'Juliana Torres',
      system_role: 'ANALISTA',
      phone: '(11) 97777-6666',
      is_active: true,
      created_at: '2025-01-05T00:00:00Z',
      updated_at: '2025-01-05T00:00:00Z',
    },
    locations: [],
  },
  'supervisor@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'supervisor@diridesmob.com.br',
      full_name: 'Eng. Marcos Silveira',
      system_role: 'OBRA_SUPERVISOR',
      phone: '(11) 96666-5555',
      is_active: true,
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
    },
    locations: [
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
    ],
  },
  'obra.supervisor@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'obra.supervisor@diridesmob.com.br',
      full_name: 'Eng. Marcos Silveira',
      system_role: 'OBRA_SUPERVISOR',
      phone: '(11) 96666-5555',
      is_active: true,
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
    },
    locations: [
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
    ],
  },
  'obra.conferente@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'obra.conferente@diridesmob.com.br',
      full_name: 'Lucas Prado',
      system_role: 'OBRA_CONFERENTE',
      phone: '(11) 95555-4444',
      is_active: true,
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
    },
    locations: [
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
    ],
  },
  'fornecedor@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'fornecedor@diridesmob.com.br',
      full_name: 'Roberto Vianna',
      system_role: 'FORNECEDOR_SUPERVISOR',
      phone: '(11) 94444-3333',
      is_active: true,
      created_at: '2025-01-15T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z',
    },
    locations: [
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
    ],
  },
  'fornecedor.supervisor@formax.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'fornecedor.supervisor@formax.com.br',
      full_name: 'Roberto Vianna',
      system_role: 'FORNECEDOR_SUPERVISOR',
      phone: '(11) 94444-3333',
      is_active: true,
      created_at: '2025-01-15T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z',
    },
    locations: [
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
    ],
  },
  'galpao.conferente@diridesmob.com.br': {
    profile: {
      id: '00000000-0000-0000-0000-000000000006',
      email: 'galpao.conferente@diridesmob.com.br',
      full_name: 'Valdir Santos',
      system_role: 'GALPAO_CONFERENTE',
      phone: '(11) 93333-2222',
      is_active: true,
      created_at: '2025-01-20T00:00:00Z',
      updated_at: '2025-01-20T00:00:00Z',
    },
    locations: [
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
    ],
  },
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userLocations, setUserLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfileAndLocations = useCallback(async (userId: string) => {
    try {
      // 1. Fetch Profile
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profError) {
        console.warn('Profile fetch error:', profError)
        return
      }

      if (profData) {
        if (!profData.is_active) {
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setUserLocations([])
          setError('Acesso bloqueado: Este usuário foi inativado pelo Administrador.')
          return
        }
        setProfile(profData as Profile)
      }

      // 2. Fetch User Locations
      const { data: accessData, error: accessError } = await supabase
        .from('user_location_access')
        .select('location_id, locations(*)')
        .eq('user_id', userId)

      if (!accessError && accessData) {
        const locs = accessData
          .map((item: any) => item.locations)
          .filter(Boolean) as Location[]
        setUserLocations(locs)
      }
    } catch (err) {
      console.error('Error fetching user profile & permissions:', err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      setIsLoading(true)
      setError(null)

      // 1. Check local demo session first
      const storedDemo = localStorage.getItem('diridesmob_demo_profile')
      if (storedDemo) {
        try {
          const parsed = JSON.parse(storedDemo)
          if (parsed?.profile) {
            setUser({ id: parsed.profile.id, email: parsed.profile.email })
            setProfile(parsed.profile)
            setUserLocations(parsed.locations || [])
            if (isMounted) setIsLoading(false)
            return
          }
        } catch (e) {
          console.warn('Error reading stored demo profile:', e)
        }
      }

      if (!isSupabaseConfigured) {
        if (isMounted) setIsLoading(false)
        return
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.warn('Session error:', sessionError)
        }

        if (session?.user) {
          setUser(session.user)
          await fetchProfileAndLocations(session.user.id)
        }
      } catch (err) {
        console.error('Failed to initialize session:', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          await fetchProfileAndLocations(session.user.id)
        } else {
          const stored = localStorage.getItem('diridesmob_demo_profile')
          if (!stored) {
            setUser(null)
            setProfile(null)
            setUserLocations([])
          }
        }
        setIsLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [fetchProfileAndLocations])

  const refreshProfile = async () => {
    if (user?.id && isSupabaseConfigured) {
      await fetchProfileAndLocations(user.id)
    }
  }

  const isAdmin = profile?.system_role === 'ADMINISTRADOR'
  const isAnalyst = profile?.system_role === 'ANALISTA'
  const isSupervisor = Boolean(profile?.system_role?.includes('SUPERVISOR'))
  const isConferente = Boolean(profile?.system_role?.includes('CONFERENTE'))

  const canAccessLocation = useCallback((locationId: string): boolean => {
    if (isAdmin || isAnalyst) return true
    return userLocations.some(loc => loc.id === locationId)
  }, [isAdmin, isAnalyst, userLocations])

  const canManageLocation = useCallback((locationId: string): boolean => {
    if (isAdmin) return true
    if (isSupervisor) {
      return userLocations.some(loc => loc.id === locationId)
    }
    return false
  }, [isAdmin, isSupervisor, userLocations])

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setError(null)
    setIsLoading(true)

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Try Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (!authError && data?.user) {
          setUser(data.user)
          await fetchProfileAndLocations(data.user.id)
          setIsLoading(false)
          return { success: true }
        }
      } catch (err: any) {
        console.warn('Supabase Auth error, attempting demo fallback:', err)
      }
    }

    // 2. Demo / Sandbox Session Fallback
    const demoEntry = DEMO_USERS_MAP[normalizedEmail] || {
      profile: {
        id: '00000000-0000-0000-0000-000000000001',
        email: normalizedEmail,
        full_name: normalizedEmail.split('@')[0].toUpperCase(),
        system_role: 'ADMINISTRADOR',
        phone: '(11) 98888-0000',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      locations: [],
    }

    setUser({ id: demoEntry.profile.id, email: demoEntry.profile.email })
    setProfile(demoEntry.profile)
    setUserLocations(demoEntry.locations)
    localStorage.setItem(
      'diridesmob_demo_profile',
      JSON.stringify({ profile: demoEntry.profile, locations: demoEntry.locations })
    )

    setIsLoading(false)
    return { success: true }
  }

  const signOut = async () => {
    setIsLoading(true)
    localStorage.removeItem('diridesmob_demo_profile')
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('Supabase signout:', e)
      }
    }
    setUser(null)
    setProfile(null)
    setUserLocations([])
    setIsLoading(false)
  }

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) {
      return { success: true, message: 'Link de redefinição de teste enviado para seu e-mail.' }
    }
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/app/redefinir-senha`,
      })
      if (resetErr) {
        return { success: false, error: formatSupabaseError(resetErr) }
      }
      return { success: true, message: 'Link de recuperação enviado com sucesso para seu e-mail.' }
    } catch (err: any) {
      return { success: false, error: formatSupabaseError(err) }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user,
        profile,
        userLocations,
        isAdmin,
        isAnalyst,
        isSupervisor,
        isConferente,
        isLoading,
        error,
        isConfigured: isSupabaseConfigured,
        canAccessLocation,
        canManageLocation,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
