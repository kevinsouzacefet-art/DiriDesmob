import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { MetricCard } from '../../components/common/MetricCard'
import { DataTable, Column } from '../../components/common/DataTable'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import {
  dashboardService,
  WorkDashboardMetrics,
  SupplierDashboardMetrics,
  WarehouseDashboardMetrics,
} from '../../services/dashboardService'
import { locationService } from '../../services/locationService'
import { useAuth } from '../../providers/AuthProvider'
import { DashboardMetrics, LossRankingItem, Location } from '../../types'
import {
  formatCurrencyBRL,
  formatNumber,
  formatAreaM2,
  formatDate,
} from '../../lib/utils'
import {
  Boxes,
  Building2,
  Truck,
  Layers,
  AlertTriangle,
  Flame,
  Clock,
  Coins,
  TrendingDown,
  Filter,
  CheckCircle2,
  PackageCheck,
  Warehouse,
  ArrowRight,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react'
import { exportToExcel } from '../../lib/exportExcel'
import { generatePdfReport } from '../../lib/exportPdf'

interface DashboardPageProps {
  onNavigate?: (path: string) => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { profile, isAdmin, isAnalyst, isSupervisor, isConferente } = useAuth()

  // Mode for preview/switching roles for Admins
  const [activeRoleView, setActiveRoleView] = useState<string>(
    isAdmin || isAnalyst ? 'ADMIN' : profile?.system_role || 'ADMIN'
  )

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [lossRanking, setLossRanking] = useState<LossRankingItem[]>([])
  const [rankingSortBy, setRankingSortBy] = useState<'VALUE' | 'PERCENTAGE'>('VALUE')

  // Role-specific metrics
  const [workMetrics, setWorkMetrics] = useState<WorkDashboardMetrics | null>(null)
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierDashboardMetrics | null>(null)
  const [warehouseMetrics, setWarehouseMetrics] = useState<WarehouseDashboardMetrics | null>(null)

  const [works, setWorks] = useState<Location[]>([])
  const [suppliers, setSuppliers] = useState<Location[]>([])
  const [warehouses, setWarehouses] = useState<Location[]>([])

  const [selectedWorkId, setSelectedWorkId] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [dateRange, setDateRange] = useState('mes_atual')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [worksData, suppliersData, warehousesData] = await Promise.all([
        locationService.listLocations('OBRA'),
        locationService.listLocations('FORNECEDOR'),
        locationService.listLocations('GALPAO'),
      ])

      setWorks(worksData)
      setSuppliers(suppliersData)
      setWarehouses(warehousesData)

      if (activeRoleView === 'ADMIN' || activeRoleView === 'ANALISTA') {
        const { metrics: admMetrics, topLossRanking } = await dashboardService.getDashboardMetrics({
          workId: selectedWorkId || undefined,
          supplierId: selectedSupplierId || undefined,
        })
        setMetrics(admMetrics)
        setLossRanking(topLossRanking)
      } else if (activeRoleView.startsWith('OBRA')) {
        const targetWorkId = selectedWorkId || worksData[0]?.id
        if (targetWorkId) {
          const wMetrics = await dashboardService.getWorkDashboardMetrics(targetWorkId)
          setWorkMetrics(wMetrics)
        }
      } else if (activeRoleView.startsWith('FORNECEDOR')) {
        const targetSupplierId = selectedSupplierId || suppliersData[0]?.id
        if (targetSupplierId) {
          const sMetrics = await dashboardService.getSupplierDashboardMetrics(targetSupplierId)
          setSupplierMetrics(sMetrics)
        }
      } else if (activeRoleView.startsWith('GALPAO')) {
        const targetWarehouseId = selectedWarehouseId || warehousesData[0]?.id
        if (targetWarehouseId) {
          const whMetrics = await dashboardService.getWarehouseDashboardMetrics(targetWarehouseId)
          setWarehouseMetrics(whMetrics)
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err)
      setError('Erro ao carregar indicadores operacionais do dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeRoleView, selectedWorkId, selectedSupplierId, selectedWarehouseId, dateRange])

  // Ranking sorting
  const sortedLossRanking = [...lossRanking].sort((a, b) => {
    if (rankingSortBy === 'VALUE') {
      return b.lossValue - a.lossValue
    }
    return b.lossPercentage - a.lossPercentage
  })

  // Export handlers
  const handleExportExcel = () => {
    if (lossRanking.length > 0) {
      exportToExcel(
        sortedLossRanking,
        [
          { header: 'Código', key: 'workCode' },
          { header: 'Obra', key: 'workName' },
          { header: 'Valor de Perda (R$)', key: r => Number(r.lossValue).toFixed(2) },
          { header: 'Taxa de Perda (%)', key: r => Number(r.lossPercentage).toFixed(2) },
          { header: 'Divergências', key: 'divergencesCount' },
        ],
        `ranking_perdas_obras_${Date.now()}`
      )
    }
  }

  const handleExportPdf = () => {
    generatePdfReport(
      {
        title: 'Painel Executivo de Desmobilização e Fôrmas',
        subtitle: 'Resumo oficial de indicadores, transportes e controle de perdas',
      },
      [
        { header: 'Código', dataKey: 'code' },
        { header: 'Obra', dataKey: 'name' },
        { header: 'Valor Perda (R$)', dataKey: 'val' },
        { header: 'Taxa (%)', dataKey: 'pct' },
      ],
      sortedLossRanking.map(r => ({
        code: r.workCode,
        name: r.workName,
        val: formatCurrencyBRL(r.lossValue),
        pct: `${formatNumber(r.lossPercentage, 1)}%`,
      }))
    )
  }

  const rankingColumns: Column<LossRankingItem>[] = [
    {
      header: 'Código',
      accessor: r => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{r.workCode}</span>
      ),
    },
    {
      header: 'Obra',
      accessor: r => <span className="font-medium text-zinc-800 dark:text-zinc-200">{r.workName}</span>,
    },
    {
      header: 'Taxa de Perda (%)',
      align: 'center',
      accessor: r => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          <TrendingDown className="w-3 h-3 mr-1" />
          {formatNumber(r.lossPercentage, 1)}%
        </span>
      ),
    },
    {
      header: 'Valor Acumulado de Perda',
      align: 'right',
      accessor: r => (
        <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
          {formatCurrencyBRL(r.lossValue)}
        </span>
      ),
    },
    {
      header: 'Divergências',
      align: 'center',
      accessor: r => (
        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
          {r.divergencesCount}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeader
        title="Painel de Controle Operacional & Indicadores"
        subtitle="Monitoramento integrado de fôrmas, estoques físicos, transportes, perdas e custos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Role switcher for Admins */}
            {(isAdmin || isAnalyst) && (
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs no-print mr-2">
                <span className="text-zinc-500 font-medium px-1">Visão:</span>
                {[
                  { id: 'ADMIN', label: 'Admin / Geral' },
                  { id: 'OBRA_SUPERVISOR', label: 'Obra' },
                  { id: 'FORNECEDOR_SUPERVISOR', label: 'Fornecedor' },
                  { id: 'GALPAO_CONFERENTE', label: 'Galpão' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRoleView(r.id)}
                    className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                      activeRoleView === r.id
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel
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
          </div>
        }
      />

      {/* Global Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>Filtros do Dashboard:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeRoleView.startsWith('OBRA') && (
              <select
                value={selectedWorkId}
                onChange={e => setSelectedWorkId(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
              >
                {works.map(w => (
                  <option key={w.id} value={w.id}>
                    Obra: {w.name} ({w.code})
                  </option>
                ))}
              </select>
            )}

            {activeRoleView.startsWith('FORNECEDOR') && (
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    Fornecedor: {s.name} ({s.code})
                  </option>
                ))}
              </select>
            )}

            {activeRoleView.startsWith('GALPAO') && (
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
              >
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>
                    Galpão: {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            )}

            {activeRoleView === 'ADMIN' && (
              <>
                <select
                  value={selectedWorkId}
                  onChange={e => setSelectedWorkId(e.target.value)}
                  className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <option value="">Todas as Obras</option>
                  {works.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>

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
              </>
            )}

            <button
              onClick={() => {
                setSelectedWorkId('')
                setSelectedSupplierId('')
                setSelectedWarehouseId('')
              }}
              className="px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Resetar
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Calculando indicadores a partir do banco de dados real..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeRoleView === 'ADMIN' && metrics ? (
        /* ================= ADMIN / ANALYST EXECUTIVE VIEW ================= */
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            <MetricCard
              label="Peças Mobilizadas"
              value={formatNumber(metrics.totalMobilizedPieces)}
              secondaryValue={formatAreaM2(metrics.mobilizedAreaM2)}
              icon={Boxes}
              color="blue"
            />
            <MetricCard
              label="Obras Concluídas"
              value={metrics.completedWorks}
              secondaryValue={`${metrics.demobilizingWorks} em desmob.`}
              icon={Building2}
              color="emerald"
            />
            <MetricCard
              label="Peças em Obras"
              value={formatNumber(metrics.piecesAtWorks)}
              secondaryValue="Estoque físico"
              icon={Layers}
              color="indigo"
            />
            <MetricCard
              label="Peças em Fornecedores"
              value={formatNumber(metrics.piecesAtSuppliers)}
              secondaryValue="Em triagem / manutenção"
              icon={Truck}
              color="amber"
            />
            <MetricCard
              label="Peças em Trânsito"
              value={formatNumber(metrics.piecesInTransit)}
              secondaryValue={`${metrics.pendingLoads} cargas pendentes`}
              icon={Truck}
              color="violet"
            />
            <MetricCard
              label="Custo Total de Perdas"
              value={formatCurrencyBRL(metrics.lossCostTotal)}
              secondaryValue={`Taxa: ${formatNumber(metrics.divergenceRate, 1)}%`}
              icon={Flame}
              color="rose"
            />
          </div>

          {/* Secondary Operational Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500">Cargas Atrasadas</span>
                <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{metrics.delayedLoads}</p>
                <span className="text-[11px] text-zinc-400">Previsão vencida em trânsito</span>
              </div>
              <Clock className="w-8 h-8 text-amber-500/30" />
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500">Pallets / Volumes Totais</span>
                <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{metrics.totalPallets}</p>
                <span className="text-[11px] text-zinc-400">Montados e expedidos</span>
              </div>
              <Layers className="w-8 h-8 text-blue-500/30" />
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500">Desmobilização Física Total</span>
                <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{formatAreaM2(metrics.demobilizedAreaM2)}</p>
                <span className="text-[11px] text-zinc-400">m² retirados de obras</span>
              </div>
              <PackageCheck className="w-8 h-8 text-emerald-500/30" />
            </div>
          </div>

          {/* Ranking of 5 Worst Works by Loss with Toggleable Metric */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Ranking das 5 Obras com Maior Índice de Perdas
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Fórmula oficial: Taxa de Perda (%) = (Custo Apurado de Perda / Base Orçada/Mobilizada) × 100
                </p>
              </div>

              {/* Toggle metric */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
                <button
                  onClick={() => setRankingSortBy('VALUE')}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                    rankingSortBy === 'VALUE'
                      ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Ordenar por Valor (R$)
                </button>
                <button
                  onClick={() => setRankingSortBy('PERCENTAGE')}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                    rankingSortBy === 'PERCENTAGE'
                      ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Ordenar por Taxa (%)
                </button>
              </div>
            </div>

            <DataTable
              data={sortedLossRanking}
              columns={rankingColumns}
              keyExtractor={r => r.workId}
              emptyTitle="Nenhuma perda registrada no período selecionado."
            />
          </div>
        </div>
      ) : activeRoleView.startsWith('OBRA') && workMetrics ? (
        /* ================= WORK SUPERVISOR / CONFERENTE VIEW ================= */
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300">OBRA SELECIONADA:</span>
              <h2 className="text-lg font-bold text-blue-950 dark:text-blue-100">{workMetrics.workName} ({workMetrics.workCode})</h2>
            </div>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">Painel Operacional da Obra</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Saldo Físico Atual"
              value={`${formatNumber(workMetrics.currentStockPieces)} un`}
              secondaryValue={formatAreaM2(workMetrics.currentStockAreaM2)}
              icon={Boxes}
              color="indigo"
            />
            <MetricCard
              label="Peças Disponíveis"
              value={`${formatNumber(workMetrics.availablePieces)} un`}
              secondaryValue="Prontas p/ desmob."
              icon={CheckCircle2}
              color="emerald"
            />
            <MetricCard
              label="Peças Reservadas"
              value={`${formatNumber(workMetrics.reservedPieces)} un`}
              secondaryValue="Alocadas em pallets"
              icon={Layers}
              color="blue"
            />
            <MetricCard
              label="Perdas Registradas"
              value={formatCurrencyBRL(workMetrics.lossesValue)}
              secondaryValue={`${workMetrics.divergencesCount} divergências`}
              icon={Flame}
              color="rose"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-semibold">Cargas Despachadas</span>
              <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{workMetrics.sentLoadsCount}</p>
              <span className="text-xs text-zinc-400">{workMetrics.pendingLoadsCount} prontas / rascunho</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-semibold">Pallets Montados na Obra</span>
              <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{workMetrics.totalPallets}</p>
              <span className="text-xs text-zinc-400">{formatAreaM2(workMetrics.sentAreaM2)} desmobilizados</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-semibold">Cargas Atrasadas</span>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{workMetrics.delayedLoadsCount}</p>
              <span className="text-xs text-zinc-400">Em trânsito</span>
            </div>
          </div>
        </div>
      ) : activeRoleView.startsWith('FORNECEDOR') && supplierMetrics ? (
        /* ================= FORNECEDOR VIEW ================= */
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">FORNECEDOR SELECIONADO:</span>
              <h2 className="text-lg font-bold text-emerald-950 dark:text-emerald-100">{supplierMetrics.supplierName} ({supplierMetrics.supplierCode})</h2>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-semibold">Painel de Manutenção & Triagem</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Cargas Recebidas"
              value={supplierMetrics.receivedLoadsCount}
              secondaryValue={`${supplierMetrics.worksServedCount} obras atendidas`}
              icon={Truck}
              color="blue"
            />
            <MetricCard
              label="Área Recebida / Conferida"
              value={formatAreaM2(supplierMetrics.receivedAreaM2)}
              secondaryValue="Base para faturamento"
              icon={Coins}
              color="emerald"
            />
            <MetricCard
              label="Aguardando Classificação"
              value={`${supplierMetrics.awaitingClassificationPieces} un`}
              secondaryValue="No pátio"
              icon={Clock}
              color="amber"
            />
            <MetricCard
              label="Custos de Serviços Apurados"
              value={formatCurrencyBRL(supplierMetrics.totalServiceCost)}
              secondaryValue={`${supplierMetrics.pendingCostCount} pendentes de taxa`}
              icon={Coins}
              color="violet"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-2">Composição do Saldo no Pátio:</span>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">Aguardando</span>
                  <p className="text-lg font-bold font-mono text-amber-600 mt-1">{supplierMetrics.awaitingClassificationPieces}</p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">Reaproveitável</span>
                  <p className="text-lg font-bold font-mono text-emerald-600 mt-1">{supplierMetrics.reusablePieces}</p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">Sucata</span>
                  <p className="text-lg font-bold font-mono text-rose-600 mt-1">{supplierMetrics.scrapPieces}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-2">Qualidade e Divergências:</span>
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-xs text-zinc-500">Divergências Registradas na Entrada</span>
                  <p className="text-xl font-bold font-mono text-rose-600 mt-1">{supplierMetrics.divergencesCount} ocorrências</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-rose-500/30" />
              </div>
            </div>
          </div>
        </div>
      ) : activeRoleView.startsWith('GALPAO') && warehouseMetrics ? (
        /* ================= CENTRAL WAREHOUSE VIEW ================= */
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">GALPÃO SELECIONADO:</span>
              <h2 className="text-lg font-bold text-indigo-950 dark:text-indigo-100">{warehouseMetrics.warehouseName} ({warehouseMetrics.warehouseCode})</h2>
            </div>
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-semibold">Painel Galpão Central</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Saldo Total no Galpão"
              value={`${formatNumber(warehouseMetrics.currentStockPieces)} un`}
              secondaryValue="Estoque central"
              icon={Boxes}
              color="indigo"
            />
            <MetricCard
              label="Peças Disponíveis"
              value={`${formatNumber(warehouseMetrics.availablePieces)} un`}
              secondaryValue="Para mobilização"
              icon={CheckCircle2}
              color="emerald"
            />
            <MetricCard
              label="Peças Reaproveitáveis"
              value={`${formatNumber(warehouseMetrics.reusablePieces)} un`}
              secondaryValue="Triadas de fornecedor"
              icon={Layers}
              color="blue"
            />
            <MetricCard
              label="Sucata no Galpão"
              value={`${formatNumber(warehouseMetrics.scrapPieces)} un`}
              secondaryValue="Pronta para destinação"
              icon={Flame}
              color="rose"
            />
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
          Nenhum dado encontrado para a visão selecionada.
        </div>
      )}
    </div>
  )
}
