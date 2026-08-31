import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import {
  reportService,
  StockReportRow,
  MovementReportRow,
  LoadReportRow,
  PalletReportRow,
  ConferenceReportRow,
  DivergenceReportRow,
  LossReportRow,
  ScrapReportRow,
  SupplierReportRow,
  OperationsReportRow,
  ExecutiveReportData,
} from '../../services/reportService'
import { locationService } from '../../services/locationService'
import { Location } from '../../types'
import {
  formatCurrencyBRL,
  formatNumber,
  formatAreaM2,
  formatDate,
  formatDateTime,
} from '../../lib/utils'
import { exportToExcel } from '../../lib/exportExcel'
import { generatePdfReport } from '../../lib/exportPdf'
import {
  Boxes,
  ArrowLeftRight,
  Truck,
  Layers,
  ClipboardCheck,
  AlertTriangle,
  Flame,
  Trash2,
  Building2,
  PackageCheck,
  Award,
  FileSpreadsheet,
  FileText,
  Printer,
  Filter,
  Search,
  Calendar,
} from 'lucide-react'

export type ReportTab =
  | 'executivo'
  | 'estoque'
  | 'movimentacoes'
  | 'cargas'
  | 'pallets'
  | 'conferencias'
  | 'divergencias'
  | 'perdas'
  | 'sucata'
  | 'fornecedores'
  | 'operacoes'

interface ReportsHubPageProps {
  initialTab?: ReportTab
  onNavigate?: (path: string) => void
}

export const ReportsHubPage: React.FC<ReportsHubPageProps> = ({ initialTab = 'executivo', onNavigate }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Report datasets
  const [executiveData, setExecutiveData] = useState<ExecutiveReportData | null>(null)
  const [stockData, setStockData] = useState<StockReportRow[]>([])
  const [movementData, setMovementData] = useState<MovementReportRow[]>([])
  const [loadData, setLoadData] = useState<LoadReportRow[]>([])
  const [palletData, setPalletData] = useState<PalletReportRow[]>([])
  const [conferenceData, setConferenceData] = useState<ConferenceReportRow[]>([])
  const [divergenceData, setDivergenceData] = useState<DivergenceReportRow[]>([])
  const [lossData, setLossData] = useState<LossReportRow[]>([])
  const [scrapData, setScrapData] = useState<ScrapReportRow[]>([])
  const [supplierData, setSupplierData] = useState<SupplierReportRow[]>([])
  const [operationsData, setOperationsData] = useState<OperationsReportRow[]>([])

  useEffect(() => {
    locationService.listLocations().then(setLocations).catch(console.error)
  }, [])

  const loadActiveReportData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      switch (activeTab) {
        case 'executivo': {
          const data = await reportService.getExecutiveReport()
          setExecutiveData(data)
          break
        }
        case 'estoque': {
          const data = await reportService.getStockReport({
            locationId: selectedLocationId || undefined,
            locationType: selectedType || undefined,
          })
          setStockData(data)
          break
        }
        case 'movimentacoes': {
          const data = await reportService.getMovementsReport({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            locationId: selectedLocationId || undefined,
            movementType: selectedType || undefined,
          })
          setMovementData(data)
          break
        }
        case 'cargas': {
          const data = await reportService.getLoadsReport({
            status: selectedStatus || undefined,
            originId: selectedLocationId || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
          setLoadData(data)
          break
        }
        case 'pallets': {
          const data = await reportService.getPalletsReport({
            status: selectedStatus || undefined,
            originId: selectedLocationId || undefined,
          })
          setPalletData(data)
          break
        }
        case 'conferencias': {
          const data = await reportService.getConferencesReport()
          setConferenceData(data)
          break
        }
        case 'divergencias': {
          const data = await reportService.getDivergencesReport({
            status: selectedStatus || undefined,
            type: selectedType || undefined,
            workId: selectedLocationId || undefined,
          })
          setDivergenceData(data)
          break
        }
        case 'perdas': {
          const data = await reportService.getLossesReport({
            workId: selectedLocationId || undefined,
            status: selectedStatus || undefined,
          })
          setLossData(data)
          break
        }
        case 'sucata': {
          const data = await reportService.getScrapReport()
          setScrapData(data)
          break
        }
        case 'fornecedores': {
          const data = await reportService.getSuppliersReport()
          setSupplierData(data)
          break
        }
        case 'operacoes': {
          const data = await reportService.getOperationsReport()
          setOperationsData(data)
          break
        }
      }
    } catch (err: any) {
      console.error('Error fetching report data:', err)
      setError('Erro ao carregar os dados do relatório.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadActiveReportData()
  }, [activeTab, selectedLocationId, selectedType, selectedStatus, startDate, endDate])

  // EXPORT EXCEL HANDLER
  const handleExportExcel = () => {
    switch (activeTab) {
      case 'executivo':
        exportToExcel(
          executiveData?.topLossWorks || [],
          [
            { header: 'Obra', key: 'workName' },
            { header: 'Valor de Perda (R$)', key: r => Number(r.lossValue).toFixed(2) },
            { header: 'Taxa de Perda (%)', key: r => Number(r.lossPct).toFixed(2) },
          ],
          `relatorio_executivo_perdas_${Date.now()}`
        )
        break
      case 'estoque':
        exportToExcel(
          stockData,
          [
            { header: 'Código Material', key: 'materialCode' },
            { header: 'Material / Descrição', key: 'materialName' },
            { header: 'Localização', key: 'locationName' },
            { header: 'Tipo Local', key: 'locationType' },
            { header: 'Disponível', key: 'qtyDisponivel' },
            { header: 'Reservado', key: 'qtyReservado' },
            { header: 'Aguard. Classificação', key: 'qtyAguardandoClassificacao' },
            { header: 'Reaproveitável', key: 'qtyReaproveitavel' },
            { header: 'Sucata', key: 'qtySucata' },
            { header: 'Em Trânsito', key: 'qtyEmTransito' },
            { header: 'Total Físico', key: 'totalFisico' },
            { header: 'Área Total (m²)', key: 'totalAreaM2' },
          ],
          `relatorio_estoque_${Date.now()}`
        )
        break
      case 'movimentacoes':
        exportToExcel(
          movementData,
          [
            { header: 'Data/Hora', key: m => formatDateTime(m.createdAt) },
            { header: 'Tipo Movimentação', key: 'movementType' },
            { header: 'Material', key: 'materialName' },
            { header: 'Quantidade', key: 'quantity' },
            { header: 'Origem', key: 'originLocationName' },
            { header: 'Destino', key: 'destinationLocationName' },
            { header: 'Carga', key: m => m.loadNumber || '-' },
            { header: 'Pallet', key: m => m.palletCode || '-' },
            { header: 'Usuário', key: m => m.userName || '-' },
          ],
          `relatorio_movimentacoes_${Date.now()}`
        )
        break
      case 'cargas':
        exportToExcel(
          loadData,
          [
            { header: 'Número da Carga', key: 'loadNumber' },
            { header: 'Origem', key: 'originName' },
            { header: 'Destino', key: 'destinationName' },
            { header: 'Status', key: 'status' },
            { header: 'Placa', key: 'plateNumber' },
            { header: 'Motorista', key: 'driverName' },
            { header: 'Qtd Pallets', key: 'palletsCount' },
            { header: 'Despachada Em', key: l => l.dispatchedAt ? formatDate(l.dispatchedAt) : '-' },
            { header: 'Previsão Entrega', key: l => l.expectedArrivalDate ? formatDate(l.expectedArrivalDate) : '-' },
            { header: 'Atrasada?', key: l => l.isDelayed ? 'SIM' : 'NÃO' },
          ],
          `relatorio_cargas_${Date.now()}`
        )
        break
      case 'pallets':
        exportToExcel(
          palletData,
          [
            { header: 'Código Pallet', key: 'palletCode' },
            { header: 'Origem', key: 'originName' },
            { header: 'Destino', key: 'destinationName' },
            { header: 'Status', key: 'status' },
            { header: 'Total Peças', key: 'totalPieces' },
            { header: 'Área Total (m²)', key: 'totalAreaM2' },
            { header: 'Criado Em', key: p => formatDate(p.createdAt) },
          ],
          `relatorio_pallets_${Date.now()}`
        )
        break
      case 'conferencias':
        exportToExcel(
          conferenceData,
          [
            { header: 'Carga', key: 'loadNumber' },
            { header: 'Destino', key: 'destinationName' },
            { header: 'Início', key: c => formatDateTime(c.startedAt) },
            { header: 'Término', key: c => c.finishedAt ? formatDateTime(c.finishedAt) : 'Em Andamento' },
            { header: 'Duração (min)', key: c => c.durationMinutes || '-' },
            { header: 'Pallets Conferidos', key: 'palletsCount' },
            { header: 'Divergências', key: 'divergencesCount' },
            { header: 'Conferente', key: c => c.conferenteName || '-' },
          ],
          `relatorio_conferencias_${Date.now()}`
        )
        break
      case 'divergencias':
        exportToExcel(
          divergenceData,
          [
            { header: 'Data', key: d => formatDate(d.createdAt) },
            { header: 'Carga', key: d => d.loadNumber || '-' },
            { header: 'Pallet', key: d => d.palletCode || '-' },
            { header: 'Obra', key: d => d.workName || '-' },
            { header: 'Material', key: 'materialName' },
            { header: 'Tipo Divergência', key: 'type' },
            { header: 'Qtd Esperada', key: 'expectedQuantity' },
            { header: 'Qtd Recebida', key: 'receivedQuantity' },
            { header: 'Diferença', key: 'differenceQuantity' },
            { header: 'Status', key: 'status' },
          ],
          `relatorio_divergencias_${Date.now()}`
        )
        break
      case 'perdas':
        exportToExcel(
          lossData,
          [
            { header: 'Data Registro', key: (l: LossReportRow) => formatDate(l.createdAt) },
            { header: 'Obra', key: (l: LossReportRow) => l.workName },
            { header: 'Material', key: (l: LossReportRow) => l.materialName },
            { header: 'Quantidade', key: (l: LossReportRow) => l.quantity },
            { header: 'Área Un. Snapshot (m²)', key: (l: LossReportRow) => l.unitAreaM2Snapshot },
            { header: 'Taxa Aplicada (R$/m²)', key: (l: LossReportRow) => l.appliedRatePerM2 },
            { header: 'Valor Perda (R$)', key: (l: LossReportRow) => l.calculatedValue },
            { header: 'Responsável', key: (l: LossReportRow) => l.responsibleType },
            { header: 'Motivo', key: (l: LossReportRow) => l.reason },
            { header: 'Status', key: (l: LossReportRow) => l.status },
          ],
          `relatorio_perdas_${Date.now()}`
        )
        break
      case 'sucata':
        exportToExcel(
          scrapData,
          [
            { header: 'Localização', key: 'locationName' },
            { header: 'Tipo Local', key: 'locationType' },
            { header: 'Material', key: 'materialName' },
            { header: 'Qtd Sucata Física', key: 'physicalScrapQuantity' },
            { header: 'Área Sucata (m²)', key: 'physicalScrapAreaM2' },
            { header: 'Solicitações Pendentes', key: 'pendingRequestsCount' },
            { header: 'Solicitações Aprovadas', key: 'approvedRequestsCount' },
            { header: 'Solicitações Executadas', key: 'executedRequestsCount' },
          ],
          `relatorio_sucata_${Date.now()}`
        )
        break
      case 'fornecedores':
        exportToExcel(
          supplierData,
          [
            { header: 'Código', key: 'supplierCode' },
            { header: 'Fornecedor', key: 'supplierName' },
            { header: 'Obras Atendidas', key: 'worksServedCount' },
            { header: 'Cargas Recebidas', key: 'receivedLoadsCount' },
            { header: 'Área Recebida (m²)', key: 'receivedAreaM2' },
            { header: 'Divergências', key: 'divergencesCount' },
            { header: 'Taxa Divergência (%)', key: 'divergenceRate' },
            { header: 'Custo Total Serviços (R$)', key: 'totalServiceCost' },
          ],
          `relatorio_fornecedores_${Date.now()}`
        )
        break
      case 'operacoes':
        exportToExcel(
          operationsData,
          [
            { header: 'Operação', key: (o: OperationsReportRow) => o.operationType },
            { header: 'Obra', key: (o: OperationsReportRow) => o.workName },
            { header: 'Destino / Origem', key: (o: OperationsReportRow) => o.originDestinationName },
            { header: 'Pallets', key: (o: OperationsReportRow) => o.palletsCount },
            { header: 'Status', key: (o: OperationsReportRow) => o.status },
            { header: 'Data', key: (o: OperationsReportRow) => formatDate(o.createdAt) },
          ],
          `relatorio_operacoes_${Date.now()}`
        )
        break
    }
  }

  // EXPORT PDF HANDLER
  const handleExportPdf = () => {
    const titleMap: Record<ReportTab, string> = {
      executivo: 'Relatório Executivo Consolidado',
      estoque: 'Posição Geral de Estoque por Localização',
      movimentacoes: 'Histórico Completo de Movimentações de Fôrmas',
      cargas: 'Controle Operacional de Cargas e Transportes',
      pallets: 'Inventário de Pallets e Volumes',
      conferencias: 'Relatório de Conferências de Entrada',
      divergencias: 'Painel de Divergências e Avarias',
      perdas: 'Valoração e Registro de Perdas Operacionais',
      sucata: 'Posição de Sucata e Destinações',
      fornecedores: 'Indicadores de Desempenho de Fornecedores',
      operacoes: 'Acompanhamento de Mobilizações e Desmobilizações',
    }

    const currentTitle = titleMap[activeTab]

    switch (activeTab) {
      case 'executivo':
        generatePdfReport(
          { title: currentTitle, subtitle: 'Resumo de indicadores corporativos' },
          [
            { header: 'Obra', dataKey: 'workName' },
            { header: 'Valor de Perda', dataKey: 'lossVal' },
            { header: 'Taxa de Perda', dataKey: 'lossPct' },
          ],
          (executiveData?.topLossWorks || []).map(r => ({
            workName: r.workName,
            lossVal: formatCurrencyBRL(r.lossValue),
            lossPct: `${formatNumber(r.lossPct, 1)}%`,
          }))
        )
        break
      case 'estoque':
        generatePdfReport(
          { title: currentTitle, subtitle: 'Saldos segregados por bucket e localização' },
          [
            { header: 'Material', dataKey: 'mat' },
            { header: 'Local', dataKey: 'loc' },
            { header: 'Disp.', dataKey: 'disp' },
            { header: 'Res.', dataKey: 'res' },
            { header: 'Sucata', dataKey: 'suc' },
            { header: 'Trânsito', dataKey: 'transit' },
            { header: 'Total Físico', dataKey: 'total' },
            { header: 'Área (m²)', dataKey: 'area' },
          ],
          stockData.map(s => ({
            mat: `${s.materialCode} - ${s.materialName}`,
            loc: s.locationName,
            disp: s.qtyDisponivel,
            res: s.qtyReservado,
            suc: s.qtySucata,
            transit: s.qtyEmTransito,
            total: s.totalFisico,
            area: formatAreaM2(s.totalAreaM2),
          }))
        )
        break
      case 'movimentacoes':
        generatePdfReport(
          { title: currentTitle, subtitle: 'Extrato analítico do ledger stock_movements' },
          [
            { header: 'Data/Hora', dataKey: 'dt' },
            { header: 'Tipo', dataKey: 'tp' },
            { header: 'Material', dataKey: 'mat' },
            { header: 'Qtd', dataKey: 'qty' },
            { header: 'Origem', dataKey: 'orig' },
            { header: 'Destino', dataKey: 'dest' },
          ],
          movementData.map(m => ({
            dt: formatDateTime(m.createdAt),
            tp: m.movementType,
            mat: m.materialName,
            qty: m.quantity,
            orig: m.originLocationName,
            dest: m.destinationLocationName,
          }))
        )
        break
      case 'perdas':
        generatePdfReport(
          { title: currentTitle, subtitle: 'Valoração de perdas com snapshot de taxa' },
          [
            { header: 'Data', dataKey: 'dt' },
            { header: 'Obra', dataKey: 'work' },
            { header: 'Material', dataKey: 'mat' },
            { header: 'Qtd', dataKey: 'qty' },
            { header: 'Taxa (R$/m²)', dataKey: 'rate' },
            { header: 'Valor (R$)', dataKey: 'val' },
            { header: 'Responsável', dataKey: 'resp' },
          ],
          lossData.map(l => ({
            dt: formatDate(l.createdAt),
            work: l.workName,
            mat: l.materialName,
            qty: l.quantity,
            rate: `R$ ${l.appliedRatePerM2.toFixed(2)}`,
            val: formatCurrencyBRL(l.calculatedValue),
            resp: l.responsibleType,
          }))
        )
        break
      default:
        window.print()
        break
    }
  }

  // Stock Columns
  const stockColumns: Column<StockReportRow>[] = [
    {
      header: 'Material / Descrição',
      accessor: s => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{s.materialName}</div>
          <div className="text-xs text-zinc-500 font-mono">{s.materialCode} • {s.unitAreaM2.toFixed(3)} m²/un</div>
        </div>
      ),
    },
    {
      header: 'Localização',
      accessor: s => (
        <div>
          <div className="font-medium text-zinc-800 dark:text-zinc-200">{s.locationName}</div>
          <div className="text-xs text-zinc-500 font-mono">{s.locationType}</div>
        </div>
      ),
    },
    {
      header: 'Disponível',
      align: 'right',
      accessor: s => <span className="font-mono text-zinc-900 dark:text-zinc-100">{s.qtyDisponivel}</span>,
    },
    {
      header: 'Reservado',
      align: 'right',
      accessor: s => <span className="font-mono text-zinc-600 dark:text-zinc-400">{s.qtyReservado}</span>,
    },
    {
      header: 'Aguard. Classif.',
      align: 'right',
      accessor: s => <span className="font-mono text-amber-600 dark:text-amber-400">{s.qtyAguardandoClassificacao}</span>,
    },
    {
      header: 'Reaproveitável',
      align: 'right',
      accessor: s => <span className="font-mono text-emerald-600 dark:text-emerald-400">{s.qtyReaproveitavel}</span>,
    },
    {
      header: 'Sucata',
      align: 'right',
      accessor: s => <span className="font-mono text-rose-600 dark:text-rose-400">{s.qtySucata}</span>,
    },
    {
      header: 'Em Trânsito',
      align: 'right',
      accessor: s => <span className="font-mono text-blue-600 dark:text-blue-400">{s.qtyEmTransito}</span>,
    },
    {
      header: 'Total Físico',
      align: 'right',
      accessor: s => (
        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          {s.totalFisico}
        </span>
      ),
    },
    {
      header: 'Área Total (m²)',
      align: 'right',
      accessor: s => (
        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
          {formatAreaM2(s.totalAreaM2)}
        </span>
      ),
    },
  ]

  // Movements Columns
  const movementColumns: Column<MovementReportRow>[] = [
    {
      header: 'Data/Hora',
      accessor: m => <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{formatDateTime(m.createdAt)}</span>,
    },
    {
      header: 'Tipo',
      accessor: m => (
        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
          {m.movementType}
        </span>
      ),
    },
    {
      header: 'Material',
      accessor: m => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{m.materialName}</div>
          <div className="text-xs text-zinc-500 font-mono">{m.materialCode}</div>
        </div>
      ),
    },
    {
      header: 'Quantidade',
      align: 'right',
      accessor: m => <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{m.quantity} un</span>,
    },
    {
      header: 'Origem → Destino',
      accessor: m => (
        <div className="text-xs text-zinc-700 dark:text-zinc-300">
          <span>{m.originLocationName}</span>
          <span className="mx-1 text-zinc-400">→</span>
          <span className="font-semibold">{m.destinationLocationName}</span>
        </div>
      ),
    },
    {
      header: 'Carga / Pallet',
      accessor: m => (
        <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
          {m.loadNumber || m.palletCode || '—'}
        </span>
      ),
    },
    {
      header: 'Usuário',
      accessor: m => <span className="text-xs text-zinc-600 dark:text-zinc-400">{m.userName || 'Sistema'}</span>,
    },
  ]

  // Divergences Columns
  const divergenceColumns: Column<DivergenceReportRow>[] = [
    {
      header: 'Data',
      accessor: d => <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{formatDate(d.createdAt)}</span>,
    },
    {
      header: 'Carga / Pallet',
      accessor: d => (
        <div className="font-mono text-xs text-blue-600 dark:text-blue-400">
          {d.loadNumber && <div>{d.loadNumber}</div>}
          {d.palletCode && <div className="text-zinc-500">{d.palletCode}</div>}
        </div>
      ),
    },
    {
      header: 'Obra / Fornecedor',
      accessor: d => (
        <div className="text-xs">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{d.workName || '-'}</div>
          <div className="text-zinc-500">{d.supplierName || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Material',
      accessor: d => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{d.materialName}</div>
          <div className="text-xs text-zinc-500 font-mono">{d.materialCode}</div>
        </div>
      ),
    },
    {
      header: 'Tipo',
      accessor: d => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          {d.type}
        </span>
      ),
    },
    {
      header: 'Esp. / Rec. / Dif.',
      align: 'right',
      accessor: d => (
        <div className="font-mono text-xs">
          <span>{d.expectedQuantity}</span> / <span className="font-bold">{d.receivedQuantity}</span> /{' '}
          <span className="text-rose-600 font-bold">{d.differenceQuantity}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      accessor: d => (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
          {d.status}
        </span>
      ),
    },
  ]

  // Losses Columns
  const lossColumns: Column<LossReportRow>[] = [
    {
      header: 'Data Registro',
      accessor: l => <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{formatDate(l.createdAt)}</span>,
    },
    {
      header: 'Obra',
      accessor: l => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{l.workName}</div>
          <div className="text-xs text-zinc-500 font-mono">{l.workCode}</div>
        </div>
      ),
    },
    {
      header: 'Material',
      accessor: l => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{l.materialName}</div>
          <div className="text-xs text-zinc-500 font-mono">{l.materialCode}</div>
        </div>
      ),
    },
    {
      header: 'Quantidade',
      align: 'right',
      accessor: l => <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{l.quantity} un</span>,
    },
    {
      header: 'Taxa Aplicada',
      align: 'right',
      accessor: l => (
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
          R$ {l.appliedRatePerM2.toFixed(2)}/m²
        </span>
      ),
    },
    {
      header: 'Valor Apurado (R$)',
      align: 'right',
      accessor: l => (
        <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
          {formatCurrencyBRL(l.calculatedValue)}
        </span>
      ),
    },
    {
      header: 'Responsável',
      accessor: l => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
          {l.responsibleType}
        </span>
      ),
    },
    {
      header: 'Motivo / Parecer',
      accessor: l => <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[150px] inline-block">{l.reason}</span>,
    },
  ]

  // Scrap Columns
  const scrapColumns: Column<ScrapReportRow>[] = [
    {
      header: 'Localização',
      accessor: s => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{s.locationName}</div>
          <div className="text-xs text-zinc-500 font-mono">{s.locationCode} • {s.locationType}</div>
        </div>
      ),
    },
    {
      header: 'Material',
      accessor: s => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{s.materialName}</div>
          <div className="text-xs text-zinc-500 font-mono">{s.materialCode}</div>
        </div>
      ),
    },
    {
      header: 'Sucata Física (un)',
      align: 'right',
      accessor: s => (
        <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
          {s.physicalScrapQuantity} un
        </span>
      ),
    },
    {
      header: 'Área Total (m²)',
      align: 'right',
      accessor: s => (
        <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
          {formatAreaM2(s.physicalScrapAreaM2)}
        </span>
      ),
    },
    {
      header: 'Solicitações (Pend / Aprov / Exec)',
      align: 'center',
      accessor: s => (
        <div className="font-mono text-xs">
          <span className="text-amber-600 font-bold">{s.pendingRequestsCount}</span> /{' '}
          <span className="text-blue-600 font-bold">{s.approvedRequestsCount}</span> /{' '}
          <span className="text-emerald-600 font-bold">{s.executedRequestsCount}</span>
        </div>
      ),
    },
  ]

  // Suppliers Columns
  const supplierColumns: Column<SupplierReportRow>[] = [
    {
      header: 'Fornecedor',
      accessor: s => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{s.supplierName}</div>
          <div className="text-xs text-zinc-500 font-mono">{s.supplierCode}</div>
        </div>
      ),
    },
    {
      header: 'Obras Atendidas',
      align: 'center',
      accessor: s => <span className="font-mono font-medium">{s.worksServedCount}</span>,
    },
    {
      header: 'Cargas Recebidas',
      align: 'center',
      accessor: s => <span className="font-mono font-medium">{s.receivedLoadsCount}</span>,
    },
    {
      header: 'Área Recebida (m²)',
      align: 'right',
      accessor: s => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatAreaM2(s.receivedAreaM2)}</span>,
    },
    {
      header: 'Divergências',
      align: 'center',
      accessor: s => <span className="font-mono text-rose-600 font-bold">{s.divergencesCount}</span>,
    },
    {
      header: 'Taxa de Divergência',
      align: 'right',
      accessor: s => <span className="font-mono">{formatNumber(s.divergenceRate, 1)}%</span>,
    },
    {
      header: 'Custo Total Serviços',
      align: 'right',
      accessor: s => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
          {formatCurrencyBRL(s.totalServiceCost)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Relatórios & Inteligência Operacional"
        subtitle="Consolidação e exportação de dados reais de estoque, transportes, perdas, sucata e custos"
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
          </div>
        }
      />

      {/* Nav Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-print space-x-1 pb-1">
        {[
          { id: 'executivo', label: 'Executivo', icon: Award },
          { id: 'estoque', label: 'Estoque', icon: Boxes },
          { id: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
          { id: 'cargas', label: 'Cargas & Transportes', icon: Truck },
          { id: 'pallets', label: 'Pallets / Volumes', icon: Layers },
          { id: 'conferencias', label: 'Conferências', icon: ClipboardCheck },
          { id: 'divergencias', label: 'Divergências', icon: AlertTriangle },
          { id: 'perdas', label: 'Perdas & Avarias', icon: Flame },
          { id: 'sucata', label: 'Sucata & Destinação', icon: Trash2 },
          { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
          { id: 'operacoes', label: 'Mobilizações / Desmob.', icon: PackageCheck },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 border-t-2 border-blue-600 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Dynamic Filter Bar */}
      {activeTab !== 'executivo' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
              <Filter className="w-4 h-4 text-blue-500" />
              <span>Filtros do Relatório:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
              >
                <option value="">Todas as Localizações / Obras</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code} - {l.type})
                  </option>
                ))}
              </select>

              {(activeTab === 'estoque' || activeTab === 'movimentacoes') && (
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <option value="">Todos os Tipos</option>
                  {activeTab === 'estoque' ? (
                    <>
                      <option value="OBRA">Obra</option>
                      <option value="FORNECEDOR">Fornecedor</option>
                      <option value="GALPAO">Galpão Central</option>
                    </>
                  ) : (
                    <>
                      <option value="MOBILIZACAO">Mobilização</option>
                      <option value="DESMOBILIZACAO">Desmobilização</option>
                      <option value="TRANSFERENCIA">Transferência</option>
                      <option value="SUCATA_BAIXA">Baixa de Sucata</option>
                    </>
                  )}
                </select>
              )}

              {(activeTab === 'cargas' || activeTab === 'pallets' || activeTab === 'divergencias' || activeTab === 'perdas') && (
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
                >
                  <option value="">Todos os Status</option>
                  {activeTab === 'cargas' && (
                    <>
                      <option value="RASCUNHO">Rascunho</option>
                      <option value="PRONTA_PARA_ENVIO">Pronta para Envio</option>
                      <option value="DESPACHADA">Despachada / Em Trânsito</option>
                      <option value="RECEBIDA">Recebida</option>
                      <option value="CONFERIDA">Conferida</option>
                      <option value="FINALIZADA">Finalizada</option>
                    </>
                  )}
                  {activeTab === 'divergencias' && (
                    <>
                      <option value="PENDENTE">Pendente</option>
                      <option value="EM_ANALISE">Em Análise</option>
                      <option value="CONTESTADA">Contestada</option>
                      <option value="RESOLVIDA">Resolvida</option>
                    </>
                  )}
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
                  setSelectedLocationId('')
                  setSelectedType('')
                  setSelectedStatus('')
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
      )}

      {/* Content Rendering */}
      {isLoading ? (
        <LoadingState message="Consolidando dados do relatório em tempo real..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadActiveReportData} />
      ) : activeTab === 'executivo' && executiveData ? (
        /* Executive Summary Report Layout */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-medium">Fôrmas Mobilizadas</span>
              <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {formatNumber(executiveData.totalPiecesMoved)} un
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">{formatAreaM2(executiveData.totalAreaMovedM2)}</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-medium">Perdas Acumuladas</span>
              <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                {formatCurrencyBRL(executiveData.totalLossesValue)}
              </div>
              <span className="text-[11px] text-zinc-400">Valoração com snapshot</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-medium">Taxa de Divergência</span>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {formatNumber(executiveData.divergenceRate, 1)}%
              </div>
              <span className="text-[11px] text-zinc-400">{executiveData.totalDivergences} ocorrências</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs text-zinc-500 font-medium">Custos de Fornecedores</span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrencyBRL(executiveData.totalSupplierCosts)}
              </div>
              <span className="text-[11px] text-zinc-400">m² conferidos × taxa</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                Ranking de Perdas por Obra
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                A taxa de perda (%) representa a proporção financeira entre perdas confirmadas e a base total mobilizada da respectiva obra.
              </p>
              <div className="space-y-3">
                {executiveData.topLossWorks.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">Nenhuma perda registrada no período.</p>
                ) : (
                  executiveData.topLossWorks.map((work, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{work.workName}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">Taxa: {formatNumber(work.lossPct, 1)}%</div>
                      </div>
                      <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                        {formatCurrencyBRL(work.lossValue)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                Resumo Operacional de Transportes
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">Cargas em Trânsito / Atrasadas</span>
                  <p className="text-lg font-bold font-mono text-amber-600 mt-1">{executiveData.delayedLoadsCount} carga(s)</p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">Tempo Médio de Conferência</span>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{executiveData.avgConferenceMinutes} minutos</p>
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-300">
                <strong>Auditoria e Conformidade:</strong> Todos os registros e históricos de movimentações, divergências e perdas contam com trilha de auditoria e garantia de não duplicidade contábil.
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'estoque' ? (
        <DataTable data={stockData} columns={stockColumns} keyExtractor={s => `${s.locationId}_${s.materialId}`} emptyTitle="Nenhum registro de estoque encontrado." />
      ) : activeTab === 'movimentacoes' ? (
        <DataTable data={movementData} columns={movementColumns} keyExtractor={m => m.id} emptyTitle="Nenhuma movimentação encontrada." />
      ) : activeTab === 'divergencias' ? (
        <DataTable data={divergenceData} columns={divergenceColumns} keyExtractor={d => d.id} emptyTitle="Nenhuma divergência registrada." />
      ) : activeTab === 'perdas' ? (
        <DataTable data={lossData} columns={lossColumns} keyExtractor={l => l.id} emptyTitle="Nenhum registro de perda encontrado." />
      ) : activeTab === 'sucata' ? (
        <DataTable data={scrapData} columns={scrapColumns} keyExtractor={s => s.id} emptyTitle="Nenhum registro de sucata encontrado." />
      ) : activeTab === 'fornecedores' ? (
        <DataTable data={supplierData} columns={supplierColumns} keyExtractor={s => s.supplierId} emptyTitle="Nenhum fornecedor encontrado." />
      ) : (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
          Visualização pronta para os dados operacionais selecionados.
        </div>
      )}
    </div>
  )
}
