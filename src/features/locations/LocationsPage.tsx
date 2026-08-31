import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { StatusBadge } from '../../components/common/StatusBadge'
import { SearchInput } from '../../components/common/SearchInput'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { locationService } from '../../services/locationService'
import { Location, LocationType } from '../../types'
import { useAuth } from '../../providers/AuthProvider'
import { Plus, MapPin, Building2, Truck, Warehouse, X } from 'lucide-react'

export const LocationsPage: React.FC = () => {
  const { isAdmin } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'OBRA' as LocationType,
    address: '',
    city: '',
    state: '',
    postal_code: '',
  })

  const loadLocations = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await locationService.listLocations()
      setLocations(data)
    } catch (err: any) {
      console.error('Error loading locations:', err)
      setError('Não foi possível carregar as localizações.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError('Código e Nome são campos obrigatórios.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      await locationService.createLocation({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        type: formData.type,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim().toUpperCase() || undefined,
        postal_code: formData.postal_code.trim() || undefined,
      })
      setIsCreateOpen(false)
      setFormData({
        code: '',
        name: '',
        type: 'OBRA',
        address: '',
        city: '',
        state: '',
        postal_code: '',
      })
      await loadLocations()
    } catch (err: any) {
      console.error('Error creating location:', err)
      setFormError(err.message || 'Falha ao cadastrar localização.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (loc: Location) => {
    if (!isAdmin) return
    try {
      await locationService.updateLocation(loc.id, { is_active: !loc.is_active })
      setLocations(prev =>
        prev.map(item => (item.id === loc.id ? { ...item, is_active: !item.is_active } : item))
      )
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const filteredLocations = locations.filter(loc => {
    const matchesSearch =
      loc.code.toLowerCase().includes(search.toLowerCase()) ||
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      (loc.city && loc.city.toLowerCase().includes(search.toLowerCase()))
    const matchesType = typeFilter === 'ALL' || loc.type === typeFilter
    return matchesSearch && matchesType
  })

  const columns: Column<Location>[] = [
    {
      header: 'Código',
      accessor: loc => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{loc.code}</span>
      ),
    },
    {
      header: 'Nome / Identificação',
      accessor: loc => <span className="font-semibold text-zinc-800 dark:text-zinc-200">{loc.name}</span>,
    },
    {
      header: 'Tipo',
      accessor: loc => <StatusBadge status={loc.type} type="location" />,
    },
    {
      header: 'Cidade / UF',
      accessor: loc => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {loc.city ? `${loc.city}/${loc.state || ''}` : '-'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: loc => <StatusBadge status={loc.is_active} type="boolean" />,
    },
    {
      header: 'Ações',
      align: 'right',
      accessor: loc =>
        isAdmin ? (
          <button
            onClick={e => {
              e.stopPropagation()
              handleToggleStatus(loc)
            }}
            className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {loc.is_active ? 'Inativar' : 'Reativar'}
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader
        title="Localizações do Sistema"
        subtitle="Cadastro central de Obras, Fornecedores e Galpões de Armazenamento"
        actions={
          isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Localização</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por código, nome ou cidade..."
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="OBRA">Apenas Obras</option>
            <option value="FORNECEDOR">Apenas Fornecedores</option>
            <option value="GALPAO">Apenas Galpões</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Carregando localizações..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLocations} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredLocations}
          keyExtractor={loc => loc.id}
          emptyTitle="Nenhuma localização encontrada"
          emptyDescription="Nenhum registro corresponde aos filtros pesquisados."
          emptyActionLabel={isAdmin ? 'Cadastrar Primeira Localização' : undefined}
          onEmptyAction={() => setIsCreateOpen(true)}
        />
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Cadastrar Nova Localização
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: OBRA-535CF"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Tipo de Localização *
                  </label>
                  <select
                    value={formData.type}
                    onChange={e =>
                      setFormData({ ...formData, type: e.target.value as LocationType })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="OBRA">Obra</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="GALPAO">Galpão Central / Logístico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Nome / Descrição da Localização *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Residencial Parque dos Pinheiros"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Av. das Américas, 1200"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="São Paulo"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="01234-567"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Localização'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
