import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { supplierRateService, CreateSupplierRateInput } from '../../services/supplierRateService'
import { locationService } from '../../services/locationService'
import { Location, SupplierServiceRate, SupplierServiceCost } from '../../types'
import { formatCurrencyBRL, formatDate, formatAreaM2 } from '../../lib/utils'
import { exportToExcel } from '../../lib/exportExcel'
import { generatePdfReport } from '../../lib/exportPdf'
import { useAuth } from '../../providers/AuthProvider'
import {
  Coins,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  Filter,
} from 'lucide-react'

interface SupplierCostsPageProps {
  onNavigate?: (path: string) => void
}

export const SupplierCostsPage: React.FC<SupplierCostsPageProps> = ({ onNavigate }) => {
  const { isAdmin, isAnalyst } = useAuth()
  const [activeTab, setActiveTab] = useState<'costs' | 'rates'>('costs')

  // Rates State
  const [rates, setRates] = useState<(SupplierServiceRate & { supplier?: any })[]>([])
  const [costs, setCosts] = useState<(SupplierServiceCost & { supplier?: any; load?: any; conference?: any })[]>([])
  const [suppliers, setSuppliers] = useState<Location[]>([])

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Rate Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false)
  const [rateForm, setRateForm] = useState<CreateSupplierRateInput>({
    supplier_id: '',
    rate_per_m2: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: null,
  })

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [suppliersData, ratesData, costsData] = await Promise.all([
        locationService.listLocations('FORNECEDOR'),
        supplierRateService.listRates(selectedSupplierId || undefined),
        supplierRateService.listServiceCosts({
          supplierId: selectedSupplierId || undefined,
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ])

      setSuppliers(suppliersData)
      setRates(ratesData)
      setCosts(costsData)
    } catch (err: any) {
      console.error('Error loading supplier costs/rates:', err)
      setError(err.message || 'Erro ao carregar custos e taxas de fornecedores.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedSupplierId, statusFilter, startDate, endDate])

  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rateForm.supplier_id || rateForm.rate_per_m2 <= 0 || !rateForm.valid_from) {
      setError('Por favor preencha todos os campos obrigatórios com valores válidos.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await supplierRateService.createRate(rateForm)
      setSuccessMessage('Taxa cadastrada com sucesso! Custos pendentes recalculados automaticamente.')
      setIsRateModalOpen(false)
      setRateForm({
        supplier_id: '',
        rate_per_m2: 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: null,
      })
      await loadData()
    } catch (err: any) {
      console.error('Error creating rate:', err)
      setError(err.message || 'Falha ao cadastrar taxa de serviço.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecalculatePending = async (supplierId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await supplierRateService.recalculatePending(supplierId)
      setSuccessMessage(`Recálculo concluído: ${res.recalculated_count} custo(s) atualizado(s).`)
      await loadData()
    } catch (err: any) {
      setError('Falha ao recalcular custos pendentes.')
    } finally {
      setIsLoading(false)
    }
  }

  // Exports
  const handleExportExcel = () => {
    if (activeTab === 'costs') {
      exportToExcel(
        costs,
        [
          { header: 'Fornecedor', key: (c: any) => c.supplier?.name || '-' },
          { header: 'Carga', key: (c: any) => c.load?.load_number || '-' },
          { header: 'Placa', key: (c: any) => c.load?.plate_number || '-' },
          { header: 'Data do Serviço', key: (c: any) => formatDate(c.service_date) },
          { header: 'Área Recebida (m²)', key: (c: any) => Number(c.received_area_m2).toFixed(2) },
          { header: 'Taxa Aplicada (R$/m²)', key: (c: any) => c.applied_rate_per_m2 ? Number(c.applied_rate_per_m2).toFixed(4) : '-' },
          { header: 'Valor Total (R$)', key: (c: any) => c.calculated_value ? Number(c.calculated_value).toFixed(2) : '-' },
          { header: 'Status', key: (c: any) => c.status },
        ],
        `custos_fornecedores_${Date.now()}`
      )
    } else {
      exportToExcel(
        rates,
        [
          { header: 'Fornecedor', key: (r: any) => r.supplier?.name || '-' },
          { header: 'Taxa (R$/m²)', key: (r: any) => Number(r.rate_per_m2).toFixed(4) },
          { header: 'Vigência Início', key: (r: any) => formatDate(r.valid_from) },
          { header: 'Vigência Fim', key: (r: any) => r.valid_to ? formatDate(r.valid_to) : 'Vigente' },
        ],
        `taxas_fornecedores_${Date.now()}`
      )
    }
  }

  const handleExportPdf = () => {
    if (activeTab === 'costs') {
      generatePdfReport(
        {
          title: 'Demonstrativo de Custos de Serviço por Fornecedor',
          subtitle: 'Memória de cálculo baseada nas conferências físicas efetivamente recebidas',
          filtersSummary: selectedSupplierId ? `Fornecedor ID: ${selectedSupplierId}` : 'Todos os fornecedores',
        },
        [
          { header: 'Fornecedor', dataKey: 'supplierName' },
          { header: 'Carga', dataKey: 'loadNumber' },
          { header: 'Data Serviço', dataKey: 'serviceDate' },
          { header: 'Área Recebida (m²)', dataKey: 'areaM2' },
          { header: 'Taxa (R$/m²)', dataKey: 'rate' },
          { header: 'Valor Total (R$)', dataKey: 'totalVal' },
          { header: 'Status', dataKey: 'status' },
        ],
        costs.map(c => ({
          supplierName: c.supplier?.name || '-',
          loadNumber: c.load?.load_number || '-',
          serviceDate: formatDate(c.service_date),
          areaM2: formatAreaM2(c.received_area_m2),
          rate: c.applied_rate_per_m2 ? `R$ ${Number(c.applied_rate_per_m2).toFixed(4)}` : 'Pendente',
          totalVal: c.calculated_value ? formatCurrencyBRL(c.calculated_value) : '-',
          status: c.status,
        }))
      )
    } else {
      generatePdfReport(
        {
          title: 'Tabela de Taxas Vigentes de Fornecedores',
          subtitle: 'Histórico de valores negociados por m² de triagem/manutenção',
        },
        [
          { header: 'Fornecedor', dataKey: 'supplierName' },
          { header: 'Taxa (R$/m²)', dataKey: 'rate' },
          { header: 'Início Vigência', dataKey: 'validFrom' },
          { header: 'Fim Vigência', dataKey: 'validTo' },
        ],
        rates.map(r => ({
          supplierName: r.supplier?.name || '-',
          rate: `R$ ${Number(r.rate_per_m2).toFixed(4)}`,
          validFrom: formatDate(r.valid_from),
          validTo: r.valid_to ? formatDate(r.valid_to) : 'Vigente',
        }))
      )
    }
  }

  // Totals calculations
  const totalCalculatedValue = costs
    .filter(c => c.status === 'CALCULADO' || c.status === 'RECALCULADO')
    .reduce((acc, c) => acc + Number(c.calculated_value || 0), 0)

  const totalReceivedAreaM2 = costs.reduce((acc, c) => acc + Number(c.received_area_m2 || 0), 0)
  const pendingCount = costs.filter(c => c.status === 'PENDENTE_DE_TAXA').length

  const costColumns: Column<SupplierServiceCost & { supplier?: any; load?: any }>[] = [
    {
      header: 'Fornecedor',
      accessor: c => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{c.supplier?.name || '-'}</div>
          <div className="text-xs text-zinc-500 font-mono">{c.supplier?.code}</div>
        </div>
      ),
    },
    {
      header: 'Carga Vinculada',
      accessor: c => (
        <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
          {c.load?.load_number || '-'}
        </span>
      ),
    },
    {
      header: 'Data do Serviço',
      accessor: c => <span className="text-zinc-700 dark:text-zinc-300">{formatDate(c.service_date)}</span>,
    },
    {
      header: 'Área Conferida (m²)',
      align: 'right',
      accessor: c => (
        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
          {formatAreaM2(c.received_area_m2)}
        </span>
      ),
    },
    {
      header: 'Taxa Aplicada',
      align: 'right',
      accessor: c => (
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {c.applied_rate_per_m2 ? `R$ ${Number(c.applied_rate_per_m2).toFixed(4)}/m²` : '—'}
        </span>
      ),
    },
    {
      header: 'Valor Total Apurado',
      align: 'right',
      accessor: c => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
          {c.calculated_value ? formatCurrencyBRL(c.calculated_value) : 'Pendente'}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      accessor: c => {
        if (c.status === 'CALCULADO' || c.status === 'RECALCULADO') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Calculado
            </span>
          )
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pendente de Taxa
          </span>
        )
      },
    },
  ]

  const rateColumns: Column<SupplierServiceRate & { supplier?: any }>[] = [
    {
      header: 'Fornecedor',
      accessor: r => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.supplier?.name || '-'}</div>
          <div className="text-xs text-zinc-500 font-mono">{r.supplier?.code}</div>
        </div>
      ),
    },
    {
      header: 'Taxa de Serviço',
      align: 'right',
      accessor: r => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
          R$ {Number(r.rate_per_m2).toFixed(4)} / m²
        </span>
      ),
    },
    {
      header: 'Início da Vigência',
      accessor: r => <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatDate(r.valid_from)}</span>,
    },
    {
      header: 'Fim da Vigência',
      accessor: r => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {r.valid_to ? formatDate(r.valid_to) : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Vigente</span>}
        </span>
      ),
    },
    {
      header: 'Ações',
      align: 'center',
      accessor: r => (
        <button
          onClick={() => handleRecalculatePending(r.supplier_id)}
          title="Recalcular conferências pendentes deste fornecedor"
          className="px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 transition-colors"
        >
          Recalcular Pendentes
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custos Operacionais & Taxas de Fornecedores"
        subtitle="Memória de cálculo imutável por conferência (m² efetivamente recebidos × taxa vigente) e controle de tarifas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel (.xlsx)
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsRateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Cadastrar Nova Taxa
              </button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total de Custos Apurados</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatCurrencyBRL(totalCalculatedValue)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Baseado em tarifas vigentes na data do serviço</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Área Total Conferida</span>
            <Coins className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatAreaM2(totalReceivedAreaM2)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">m² físicos recebidos nos fornecedores</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Custos Pendentes de Taxa</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Conferências sem taxa cadastrada na data</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 no-print">
        <button
          onClick={() => setActiveTab('costs')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'costs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Extrato de Custos por Carga ({costs.length})
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'rates'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Tabela Histórica de Taxas ({rates.length})
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>Filtros:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            >
              <option value="">Todos os Fornecedores</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>

            {activeTab === 'costs' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
              >
                <option value="">Todos os Status</option>
                <option value="CALCULADO">Calculado</option>
                <option value="PENDENTE_DE_TAXA">Pendente de Taxa</option>
              </select>
            )}

            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              placeholder="Data Inicial"
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            />

            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              placeholder="Data Final"
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            />

            <button
              onClick={() => {
                setSelectedSupplierId('')
                setStatusFilter('')
                setStartDate('')
                setEndDate('')
              }}
              className="px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">×</button>
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Carregando dados financeiros e custos..." />
      ) : activeTab === 'costs' ? (
        <DataTable
          data={costs}
          columns={costColumns}
          keyExtractor={c => c.id}
          emptyTitle="Nenhum registro de custo de serviço encontrado para os filtros informados."
        />
      ) : (
        <DataTable
          data={rates}
          columns={rateColumns}
          keyExtractor={r => r.id}
          emptyTitle="Nenhuma taxa de fornecedor cadastrada."
        />
      )}

      {/* Create Rate Modal */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-600" />
                Cadastrar Taxa de Serviço de Fornecedor
              </h3>
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fornecedor *
                </label>
                <select
                  value={rateForm.supplier_id}
                  onChange={e => setRateForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o Fornecedor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Valor da Taxa por m² (R$) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={rateForm.rate_per_m2 || ''}
                  onChange={e => setRateForm(prev => ({ ...prev, rate_per_m2: parseFloat(e.target.value) || 0 }))}
                  required
                  placeholder="Ex: 14.5000"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Início da Vigência *
                  </label>
                  <input
                    type="date"
                    value={rateForm.valid_from}
                    onChange={e => setRateForm(prev => ({ ...prev, valid_from: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Fim da Vigência (Opcional)
                  </label>
                  <input
                    type="date"
                    value={rateForm.valid_to || ''}
                    onChange={e => setRateForm(prev => ({ ...prev, valid_to: e.target.value || null }))}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Nota: O sistema valida conflitos de datas e dispara automaticamente o recálculo de todas as conferências com status pendente de taxa para este fornecedor.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Taxa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
