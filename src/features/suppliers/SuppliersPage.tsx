import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { StatusBadge } from '../../components/common/StatusBadge'
import { SearchInput } from '../../components/common/SearchInput'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { supplierService } from '../../services/supplierService'
import { SupplierWithLocation } from '../../types'
import { useAuth } from '../../providers/AuthProvider'
import { Plus, Truck, Mail, Phone, User, X } from 'lucide-react'

export const SuppliersPage: React.FC = () => {
  const { isAdmin } = useAuth()
  const [suppliers, setSuppliers] = useState<SupplierWithLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    cnpj: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    city: '',
    state: 'SP',
    address: '',
  })

  const loadSuppliers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await supplierService.listSuppliers()
      setSuppliers(data)
    } catch (err: any) {
      console.error('Error loading suppliers:', err)
      setError('Não foi possível carregar os fornecedores.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError('Código e Razão Social são obrigatórios.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)
      await supplierService.createSupplier({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim() || undefined,
        contact_name: formData.contact_name.trim() || undefined,
        contact_phone: formData.contact_phone.trim() || undefined,
        contact_email: formData.contact_email.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim().toUpperCase() || undefined,
        address: formData.address.trim() || undefined,
      })

      setIsCreateOpen(false)
      setFormData({
        code: '',
        name: '',
        cnpj: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        city: '',
        state: 'SP',
        address: '',
      })
      await loadSuppliers()
    } catch (err: any) {
      console.error('Error creating supplier:', err)
      setFormError(err.message || 'Falha ao cadastrar fornecedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (supplier: SupplierWithLocation) => {
    if (!isAdmin) return
    try {
      await supplierService.updateSupplier(supplier.id, {
        is_active: !supplier.is_active,
      })
      setSuppliers(prev =>
        prev.map(s => (s.id === supplier.id ? { ...s, is_active: !s.is_active } : s))
      )
    } catch (err) {
      console.error('Error updating supplier status:', err)
    }
  }

  const filteredSuppliers = suppliers.filter(s => {
    const term = search.toLowerCase()
    return (
      s.location?.code.toLowerCase().includes(term) ||
      s.location?.name.toLowerCase().includes(term) ||
      (s.cnpj && s.cnpj.toLowerCase().includes(term)) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(term))
    )
  })

  const columns: Column<SupplierWithLocation>[] = [
    {
      header: 'Código',
      accessor: s => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
          {s.location?.code || '-'}
        </span>
      ),
    },
    {
      header: 'Fornecedor / Razão Social',
      accessor: s => (
        <div>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
            {s.location?.name}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {s.cnpj ? `CNPJ: ${s.cnpj}` : 'CNPJ não informado'}
          </span>
        </div>
      ),
    },
    {
      header: 'Contato Principal',
      accessor: s => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span>{s.contact_name || 'Não informado'}</span>
          </div>
          {s.contact_email && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <Mail className="w-3 h-3 text-zinc-400" />
              <span>{s.contact_email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Telefone',
      accessor: s => (
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <Phone className="w-3.5 h-3.5 text-zinc-400" />
          <span>{s.contact_phone || '-'}</span>
        </div>
      ),
    },
    {
      header: 'Localização',
      accessor: s => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {s.location?.city ? `${s.location.city}/${s.location.state || ''}` : '-'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: s => <StatusBadge status={s.is_active} type="boolean" />,
    },
    {
      header: 'Ações',
      align: 'right',
      accessor: s =>
        isAdmin ? (
          <button
            onClick={() => handleToggleStatus(s)}
            className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {s.is_active ? 'Inativar' : 'Reativar'}
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader
        title="Gestão de Fornecedores"
        subtitle="Controle dos parceiros industriais, locadores e fabricantes de fôrmas"
        actions={
          isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Fornecedor</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por código, fornecedor, CNPJ ou contato..."
        />
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Carregando fornecedores..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSuppliers} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSuppliers}
          keyExtractor={s => s.id}
          emptyTitle="Nenhum fornecedor encontrado"
          emptyDescription="Nenhum registro corresponde aos critérios pesquisados."
          emptyActionLabel={isAdmin ? 'Cadastrar Primeiro Fornecedor' : undefined}
          onEmptyAction={() => setIsCreateOpen(true)}
        />
      )}

      {/* Create Supplier Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Cadastrar Fornecedor / Fabricante
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
                    placeholder="Ex: FORN-FORMAX"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={formData.cnpj}
                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Razão Social / Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Formax Estruturas e Fôrmas Ltda"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Pessoa de Contato
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Roberto Vianna"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={formData.contact_phone}
                    onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="(11) 98888-7777"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  E-mail de Contato
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="contato@fornecedor.com.br"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Campinas"
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
                  {isSubmitting ? 'Salvando...' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
