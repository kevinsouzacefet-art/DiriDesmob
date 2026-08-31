import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { StatusBadge } from '../../components/common/StatusBadge'
import { SearchInput } from '../../components/common/SearchInput'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { userService } from '../../services/userService'
import { locationService } from '../../services/locationService'
import { UserWithLocations, Location, UserSystemRole } from '../../types'
import { getRoleLabel } from '../../lib/utils'
import { Shield, MapPin, Key, X, Check } from 'lucide-react'

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserWithLocations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Access Matrix Modal
  const [selectedUser, setSelectedUser] = useState<UserWithLocations | null>(null)
  const [userLocationIds, setUserLocationIds] = useState<string[]>([])
  const [isSavingAccess, setIsSavingAccess] = useState(false)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [usersData, locationsData] = await Promise.all([
        userService.listUsers(),
        locationService.listLocations(),
      ])
      setUsers(usersData)
      setLocations(locationsData)
    } catch (err: any) {
      console.error('Error loading users:', err)
      setError('Não foi possível carregar os usuários e acessos.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openAccessModal = async (user: UserWithLocations) => {
    setSelectedUser(user)
    try {
      const accesses = await userService.getUserLocationAccess(user.id)
      setUserLocationIds(accesses)
    } catch (err) {
      console.error('Error loading user location access:', err)
      setUserLocationIds([])
    }
  }

  const toggleLocationSelection = (locId: string) => {
    setUserLocationIds(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    )
  }

  const handleSaveAccess = async () => {
    if (!selectedUser) return
    try {
      setIsSavingAccess(true)
      await userService.setUserLocationAccess(selectedUser.id, userLocationIds)
      setSelectedUser(null)
      await loadData()
    } catch (err) {
      console.error('Error saving user access:', err)
    } finally {
      setIsSavingAccess(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserSystemRole) => {
    try {
      await userService.updateUserRoleOrStatus(userId, { system_role: newRole })
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, system_role: newRole } : u))
      )
    } catch (err) {
      console.error('Error changing role:', err)
    }
  }

  const filteredUsers = users.filter(u => {
    const term = search.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.system_role.toLowerCase().includes(term)
    )
  })

  const columns: Column<UserWithLocations>[] = [
    {
      header: 'Nome do Usuário',
      accessor: u => (
        <div>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
            {u.full_name || 'Sem nome'}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">{u.email}</span>
        </div>
      ),
    },
    {
      header: 'Perfil no Sistema (RBAC)',
      accessor: u => (
        <select
          value={u.system_role}
          onChange={e => handleRoleChange(u.id, e.target.value as UserSystemRole)}
          className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ADMINISTRADOR">Administrador (Global)</option>
          <option value="ANALISTA">Analista (Global Leitura)</option>
          <option value="OBRA_SUPERVISOR">Supervisor de Obra</option>
          <option value="OBRA_CONFERENTE">Conferente de Obra</option>
          <option value="FORNECEDOR_SUPERVISOR">Supervisor Fornecedor</option>
          <option value="FORNECEDOR_CONFERENTE">Conferente Fornecedor</option>
          <option value="GALPAO_CONFERENTE">Conferente Galpão</option>
        </select>
      ),
    },
    {
      header: 'Acessos a Localizações',
      accessor: u => {
        if (u.system_role === 'ADMINISTRADOR' || u.system_role === 'ANALISTA') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Acesso Global a Todas as Unidades
            </span>
          )
        }
        return (
          <button
            onClick={() => openAccessModal(u)}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            <span>Gerenciar Unidades Vinculadas</span>
          </button>
        )
      },
    },
    {
      header: 'Status',
      accessor: u => <StatusBadge status={u.is_active} type="boolean" />,
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader
        title="Usuários & Matriz de Acessos"
        subtitle="Gerenciamento de credenciais, papéis de segurança e restrição de localizações (RLS)"
      />

      <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, e-mail ou perfil..."
        />
      </div>

      {isLoading ? (
        <LoadingState message="Carregando matriz de usuários..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredUsers}
          keyExtractor={u => u.id}
          emptyTitle="Nenhum usuário encontrado"
          emptyDescription="Nenhum usuário corresponde aos filtros."
        />
      )}

      {/* Location Access Matrix Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Vincular Unidades Autorizadas (RLS)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Usuário: {selectedUser.full_name} ({getRoleLabel(selectedUser.system_role)})
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 my-3">
              Marque as localizações (Obras, Fornecedores ou Galpões) que este usuário terá permissão para visualizar e operar:
            </p>

            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md">
              {locations.map(loc => {
                const isSelected = userLocationIds.includes(loc.id)
                return (
                  <label
                    key={loc.id}
                    className="flex items-center justify-between p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLocationSelection(loc.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700"
                      />
                      <div>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 mr-2">
                          {loc.code}
                        </span>
                        <span className="text-zinc-700 dark:text-zinc-300">{loc.name}</span>
                      </div>
                    </div>
                    <StatusBadge status={loc.type} type="location" />
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingAccess}
                onClick={handleSaveAccess}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingAccess ? 'Salvando...' : 'Salvar Acessos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
