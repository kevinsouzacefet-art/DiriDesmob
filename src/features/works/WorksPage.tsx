import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { StatusBadge } from '../../components/common/StatusBadge'
import { SearchInput } from '../../components/common/SearchInput'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { workService } from '../../services/workService'
import { WorkWithLocation, WorkStatus } from '../../types'
import { useAuth } from '../../providers/AuthProvider'
import { Plus, Building2, User, X, MapPin } from 'lucide-react'

export const WorksPage: React.FC = () => {
  const { isAdmin, canAccessLocation } = useAuth()
  const [works, setWorks] = useState<WorkWithLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    state: 'SP',
    postal_code: '',
    status: 'EM_ANDAMENTO' as WorkStatus,
    manager_name: '',
    notes: '',
  })

  const loadWorks = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await workService.listWorks()
      setWorks(data)
    } catch (err: any) {
      console.error('Error loading works:', err)
      setError('Não foi possível carregar as obras.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWorks()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError('Código da Obra e Nome são obrigatórios.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      await workService.createWork({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim().toUpperCase() || undefined,
        postal_code: formData.postal_code.trim() || undefined,
        status: formData.status,
        manager_name: formData.manager_name.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      })

      setIsCreateOpen(false)
      setFormData({
        code: '',
        name: '',
        address: '',
        city: '',
        state: 'SP',
        postal_code: '',
        status: 'EM_ANDAMENTO',
        manager_name: '',
        notes: '',
      })
      await loadWorks()
    } catch (err: any) {
      console.error('Error creating work:', err)
      setFormError(err.message || 'Falha ao criar obra.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: WorkStatus) => {
    try {
      await workService.updateWork(id, { status: newStatus })
      setWorks(prev =>
        prev.map(w => (w.id === id ? { ...w, status: newStatus } : w))
      )
    } catch (err) {
      console.error('Error updating work status:', err)
    }
  }

  const filteredWorks = works.filter(w => {
    const matchesSearch =
      w.location?.code.toLowerCase().includes(search.toLowerCase()) ||
      w.location?.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.manager_name && w.manager_name.toLowerCase().includes(search.toLowerCase())) ||
      (w.location?.city && w.location.city.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const columns: Column<WorkWithLocation>[] = [
    {
      header: 'Código da Obra',
      accessor: w => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
          {w.location?.code || '-'}
        </span>
      ),
    },
    {
      header: 'Nome do Canteiro / Empreendimento',
      accessor: w => (
        <div>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
            {w.location?.name}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {w.location?.address ? `${w.location.address} — ` : ''}
            {w.location?.city ? `${w.location.city}/${w.location.state || ''}` : '-'}
          </span>
        </div>
      ),
    },
    {
      header: 'Eng. Responsável',
      accessor: w => (
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span>{w.manager_name || 'Não informado'}</span>
        </div>
      ),
    },
    {
      header: 'Status Operacional',
      accessor: w => <StatusBadge status={w.status} type="work" />,
    },
    {
      header: 'Ações',
      align: 'right',
      accessor: w => {
        if (!isAdmin && !canAccessLocation(w.id)) return null
        return (
          <select
            value={w.status}
            onChange={e => handleUpdateStatus(w.id, e.target.value as WorkStatus)}
            className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="PLANEJADA">Planejada</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="PARALISADA">Paralisada</option>
          </select>
        )
      },
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader
        title="Gestão de Obras"
        subtitle="Cadastro e monitoramento dos canteiros de obras atendidos pelo sistema (locations + works)"
        actions={
          isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Obra</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por código, nome da obra, cidade ou engenheiro..."
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PLANEJADA">Planejada</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="PARALISADA">Paralisada</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Carregando obras..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadWorks} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredWorks}
          keyExtractor={w => w.id}
          emptyTitle="Nenhuma obra encontrada"
          emptyDescription="Nenhuma obra corresponde aos critérios pesquisados."
          emptyActionLabel={isAdmin ? 'Cadastrar Primeira Obra' : undefined}
          onEmptyAction={() => setIsCreateOpen(true)}
        />
      )}

      {/* Create Work Modal (Strict Columns: locations + works) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Cadastrar Canteiro de Obra
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
                    Código da Obra *
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
                    Status Operacional *
                  </label>
                  <select
                    value={formData.status}
                    onChange={e =>
                      setFormData({ ...formData, status: e.target.value as WorkStatus })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="PLANEJADA">Planejada</option>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="PARALISADA">Paralisada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Nome da Obra / Empreendimento *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Residencial Park Towers"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Engenheiro / Responsável
                </label>
                <input
                  type="text"
                  value={formData.manager_name}
                  onChange={e =>
                    setFormData({ ...formData, manager_name: e.target.value })
                  }
                  placeholder="Eng. Marcos Silveira"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Endereço do Canteiro
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua das Palmeiras, 300 - Bela Vista"
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
                    onChange={e =>
                      setFormData({ ...formData, postal_code: e.target.value })
                    }
                    placeholder="01310-200"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais do canteiro"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
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
                  {isSubmitting ? 'Salvando...' : 'Salvar Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
