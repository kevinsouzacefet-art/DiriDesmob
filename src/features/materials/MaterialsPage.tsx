import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { StatusBadge } from '../../components/common/StatusBadge'
import { SearchInput } from '../../components/common/SearchInput'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { materialService } from '../../services/materialService'
import { lossRateService } from '../../services/lossRateService'
import { workService } from '../../services/workService'
import { Material, LossValuationRateWithRelations, WorkWithLocation } from '../../types'
import { useAuth } from '../../providers/AuthProvider'
import { formatCurrencyBRL, formatAreaM2 } from '../../lib/utils'
import { Plus, Layers, Edit3, X, Lock, TrendingUp, Calendar, AlertCircle, Building2 } from 'lucide-react'

export const MaterialsPage: React.FC = () => {
  const { isAdmin, isAnalyst } = useAuth()
  const canViewRates = isAdmin || isAnalyst

  const [materials, setMaterials] = useState<Material[]>([])
  const [lossRates, setLossRates] = useState<LossValuationRateWithRelations[]>([])
  const [works, setWorks] = useState<WorkWithLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  // Material Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    width_mm: 600,
    height_mm: 2400,
    unit: 'UN',
  })

  // Loss Rate Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false)
  const [rateFormData, setRateFormData] = useState({
    material_id: '',
    work_id: '',
    rate_per_m2: 250,
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    notes: '',
  })
  const [isRateSubmitting, setIsRateSubmitting] = useState(false)
  const [rateFormError, setRateFormError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [matData, ratesData, worksData] = await Promise.all([
        materialService.listMaterials(activeOnly),
        canViewRates ? lossRateService.listLossRates() : Promise.resolve([]),
        workService.listWorks(),
      ])
      setMaterials(matData)
      setLossRates(ratesData)
      setWorks(worksData)
    } catch (err: any) {
      console.error('Error loading materials data:', err)
      setError('Não foi possível carregar o catálogo de materiais e taxas.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeOnly, canViewRates])

  const openCreateModal = () => {
    setEditingMaterial(null)
    setFormData({
      code: '',
      name: '',
      width_mm: 600,
      height_mm: 2400,
      unit: 'UN',
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (mat: Material) => {
    setEditingMaterial(mat)
    setFormData({
      code: mat.code,
      name: mat.name,
      width_mm: mat.width_mm,
      height_mm: mat.height_mm,
      unit: mat.unit,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const openRateModalForMaterial = (mat?: Material) => {
    setRateFormData({
      material_id: mat ? mat.id : (materials[0]?.id || ''),
      work_id: '',
      rate_per_m2: 250,
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: '',
      notes: '',
    })
    setRateFormError(null)
    setIsRateModalOpen(true)
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError('Código e Nome do Material são obrigatórios.')
      return
    }

    if (formData.width_mm <= 0 || formData.height_mm <= 0) {
      setFormError('As dimensões em milímetros devem ser maiores que zero.')
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)

      if (editingMaterial) {
        await materialService.updateMaterial(editingMaterial.id, {
          name: formData.name.trim(),
          width_mm: Number(formData.width_mm),
          height_mm: Number(formData.height_mm),
          unit: formData.unit,
        })
      } else {
        await materialService.createMaterial({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          width_mm: Number(formData.width_mm),
          height_mm: Number(formData.height_mm),
          unit: formData.unit,
        })
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error('Error saving material:', err)
      setFormError(err.message || 'Falha ao salvar material.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveLossRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rateFormData.material_id) {
      setRateFormError('Selecione o material obrigatório.')
      return
    }

    if (rateFormData.rate_per_m2 < 0) {
      setRateFormError('O valor por m² não pode ser negativo.')
      return
    }

    if (!rateFormData.valid_from) {
      setRateFormError('A data de início de vigência é obrigatória.')
      return
    }

    if (rateFormData.valid_to && rateFormData.valid_to < rateFormData.valid_from) {
      setRateFormError('A data final de vigência não pode ser anterior à data inicial.')
      return
    }

    try {
      setIsRateSubmitting(true)
      setRateFormError(null)
      await lossRateService.createLossRate({
        material_id: rateFormData.material_id,
        work_id: rateFormData.work_id || null,
        rate_per_m2: Number(rateFormData.rate_per_m2),
        valid_from: rateFormData.valid_from,
        valid_to: rateFormData.valid_to || null,
        notes: rateFormData.notes.trim() || undefined,
      })

      setIsRateModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error('Error saving loss rate:', err)
      setRateFormError(err.message || 'Falha ao cadastrar taxa de perda.')
    } finally {
      setIsRateSubmitting(false)
    }
  }

  const handleToggleStatus = async (mat: Material) => {
    if (!isAdmin) return
    try {
      await materialService.toggleActive(mat.id, mat.is_active)
      setMaterials(prev =>
        prev.map(m => (m.id === mat.id ? { ...m, is_active: !m.is_active } : m))
      )
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  const calculatedM2 = Number(((formData.width_mm / 1000) * (formData.height_mm / 1000)).toFixed(4))

  const filteredMaterials = materials.filter(m => {
    const term = search.toLowerCase()
    return (
      m.code.toLowerCase().includes(term) ||
      m.name.toLowerCase().includes(term)
    )
  })

  // Table Columns - strictly adhering to the approved schema
  const columns: Column<Material>[] = [
    {
      header: 'Código',
      accessor: (m) => (
        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
          {m.code}
        </span>
      ),
    },
    {
      header: 'Nome / Descrição',
      accessor: (m) => (
        <div>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span>
          <span className="block text-[11px] text-zinc-500">Unidade: {m.unit}</span>
        </div>
      ),
    },
    {
      header: 'Dimensões (L × A)',
      accessor: (m) => (
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {m.width_mm} × {m.height_mm} mm
        </span>
      ),
    },
    {
      header: 'Área Unitária',
      accessor: (m) => (
        <div className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {formatAreaM2(m.unit_area_m2)}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (m) => (
        <StatusBadge
          status={m.is_active ? 'ATIVO' : 'INATIVO'}
          variant={m.is_active ? 'success' : 'neutral'}
        />
      ),
    },
    {
      header: 'Ações',
      align: 'right',
      accessor: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          {canViewRates && (
            <button
              onClick={() => openRateModalForMaterial(m)}
              className="p-1.5 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors text-xs font-medium flex items-center gap-1"
              title="Ver / Ajustar Taxa de Perda"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Taxas</span>
            </button>
          )}

          {isAdmin ? (
            <>
              <button
                onClick={() => openEditModal(m)}
                className="p-1.5 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                title="Editar Material"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleToggleStatus(m)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                  m.is_active
                    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                {m.is_active ? 'Desativar' : 'Ativar'}
              </button>
            </>
          ) : (
            <span className="text-[11px] text-zinc-400 italic">Somente leitura</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catálogo de Materiais"
        description="Gestão centralizada de fôrmas, dimensões, cálculo automático de área (m²) e taxas históricas de valoração de perdas."
        actions={
          <div className="flex items-center gap-2">
            {canViewRates && (
              <button
                onClick={() => openRateModalForMaterial()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Tabela de Taxas (loss_valuation_rates)</span>
              </button>
            )}

            {isAdmin ? (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Material</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-md">
                <Lock className="w-3 h-3 text-zinc-400" />
                <span>Modo Leitura</span>
              </div>
            )}
          </div>
        }
      />

      {/* Info Callout */}
      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            <strong>Regra de Área e Valoração:</strong> Área (m²) = (Largura mm / 1000) × (Altura mm / 1000). A apuração financeira de perdas busca a taxa por m² com prioridade: <strong>1. Taxa Específica da Obra</strong> &gt; <strong>2. Taxa Padrão do Material</strong>.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por código ou nome da fôrma..."
        />

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700"
            />
            <span>Apenas Materiais Ativos</span>
          </label>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Carregando catálogo de materiais..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredMaterials}
          keyExtractor={m => m.id}
          emptyTitle="Nenhum material encontrado"
          emptyDescription="Nenhum material corresponde aos critérios pesquisados."
          emptyActionLabel={isAdmin ? 'Cadastrar Primeiro Material' : undefined}
          onEmptyAction={openCreateModal}
        />
      )}

      {/* Modal: Create/Edit Material (Strict Columns ONLY) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {editingMaterial ? 'Editar Material' : 'Cadastrar Novo Material'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSaveMaterial} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Código da Peça *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMaterial}
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: PAN-2400-600"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Unidade
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="UN, M, CJ"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Nome / Descrição da Peça *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Painel Fôrma Metálica 2400x600"
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Largura (mm) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={formData.width_mm}
                    onChange={e => setFormData({ ...formData, width_mm: Number(e.target.value) })}
                    placeholder="600"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Altura (mm) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={formData.height_mm}
                    onChange={e => setFormData({ ...formData, height_mm: Number(e.target.value) })}
                    placeholder="2400"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Calculated Area Display */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Área Unitária Calculada
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    ({formData.width_mm}/1000) × ({formData.height_mm}/1000)
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatAreaM2(calculatedM2)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Loss Valuation Rates History & Creation (Specific + Default Hierarchy) */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Taxas de Valoração de Perdas (loss_valuation_rates)</span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Tabela com hierarquia: <strong>1. Taxa Específica da Obra</strong> &gt; <strong>2. Taxa Padrão do Material</strong>
                </p>
              </div>
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {rateFormError && (
              <div className="mt-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs shrink-0">
                {rateFormError}
              </div>
            )}

            {/* List of existing historical rates */}
            <div className="mt-4 flex-1 overflow-y-auto min-h-48 pr-1">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                Vigências e Taxas Cadastradas ({lossRates.length})
              </label>
              <div className="space-y-2">
                {lossRates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                    Nenhuma taxa cadastrada.
                  </div>
                ) : (
                  lossRates.map(rate => (
                    <div
                      key={rate.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {rate.material?.code || rate.material_id}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                            {rate.material?.name}
                          </span>
                          {rate.work ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              Obra: {rate.work.location?.name || 'Obra Específica'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                              Taxa Padrão
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                          <span>Vigência: {rate.valid_from} {rate.valid_to ? `até ${rate.valid_to}` : '(atual)'}</span>
                          {rate.notes && <span className="italic">• {rate.notes}</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyBRL(rate.rate_per_m2)} / m²
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* New Rate Form - Only for ADMINISTRADOR */}
            {isAdmin ? (
              <form onSubmit={handleSaveLossRate} className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3 shrink-0">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Cadastrar Nova Taxa de Valoração
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Material *
                    </label>
                    <select
                      required
                      value={rateFormData.material_id}
                      onChange={e => setRateFormData({ ...rateFormData, material_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 font-mono"
                    >
                      <option value="">Selecione um material...</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.code} - {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Obra (Opcional - Em branco para Taxa Padrão)
                    </label>
                    <select
                      value={rateFormData.work_id}
                      onChange={e => setRateFormData({ ...rateFormData, work_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="">-- Taxa Padrão (Sem Obra Específica) --</option>
                      {works.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.location?.code} - {w.location?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Valor / m² (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={rateFormData.rate_per_m2}
                      onChange={e => setRateFormData({ ...rateFormData, rate_per_m2: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Válido de *
                    </label>
                    <input
                      type="date"
                      required
                      value={rateFormData.valid_from}
                      onChange={e => setRateFormData({ ...rateFormData, valid_from: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Válido até (Opcional)
                    </label>
                    <input
                      type="date"
                      value={rateFormData.valid_to}
                      onChange={e => setRateFormData({ ...rateFormData, valid_to: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Observações / Justificativa
                  </label>
                  <input
                    type="text"
                    value={rateFormData.notes}
                    onChange={e => setRateFormData({ ...rateFormData, notes: e.target.value })}
                    placeholder="Ex: Acordo aditivo Obra Park Towers 2026"
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRateModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isRateSubmitting}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isRateSubmitting ? 'Salvando...' : 'Salvar Nova Taxa'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500 italic">
                  Apenas usuários com perfil Administrador podem cadastrar novas taxas.
                </span>
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
