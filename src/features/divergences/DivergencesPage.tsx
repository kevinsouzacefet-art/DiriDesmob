import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Camera,
  Layers,
  Image as ImageIcon,
  Package,
  Eye,
  X,
  FileText,
  User,
  Building2,
  Truck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  ShieldAlert,
  Calendar,
  DollarSign,
  History,
  MessageSquare,
  Check,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  DivergenceWithDetails,
  DivergenceType,
  DivergenceStatus,
  Location,
  Material,
  LoadWithRelations,
} from '../../types'
import { divergenceService, DivergenceFilterParams } from '../../services/divergenceService'
import { lossService } from '../../services/lossService'
import { locationService } from '../../services/locationService'
import { materialService } from '../../services/materialService'
import { conferenceService } from '../../services/conferenceService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface DivergencesPageProps {
  onNavigateToConference?: (loadId: string) => void
  onNavigateToLosses?: () => void
}

export const DivergencesPage: React.FC<DivergencesPageProps> = ({
  onNavigateToConference,
  onNavigateToLosses,
}) => {
  const { profile, isAdmin, isAnalyst } = useAuth()
  const canAdministrate = isAdmin || isAnalyst

  const [divergences, setDivergences] = useState<DivergenceWithDetails[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [locationFilter, setLocationFilter] = useState<string>('ALL')
  const [materialFilter, setMaterialFilter] = useState<string>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Detail Modal / Actions
  const [selectedDivergence, setSelectedDivergence] = useState<DivergenceWithDetails | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)

  // Modal Action States
  const [actionType, setActionType] = useState<
    'NONE' | 'CONTEST' | 'RESOLVE_FOUND' | 'CONFIRM_MISSING' | 'CLOSE_WITHOUT_LOSS' | 'CREATE_LOSS' | 'ADD_NOTE'
  >('NONE')
  const [actionNotes, setActionNotes] = useState('')
  const [contestReason, setContestReason] = useState('')
  const [lossResponsibleType, setLossResponsibleType] = useState<'OBRA' | 'FORNECEDOR' | 'TRANSPORTADORA' | 'INTERNO'>('OBRA')
  const [lossResponsibleId, setLossResponsibleId] = useState<string>('')
  const [lossReason, setLossReason] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [divs, locs, mats] = await Promise.all([
        divergenceService.getDivergences(),
        locationService.getLocations(),
        materialService.listMaterials(),
      ])
      setDivergences(divs)
      setLocations(locs)
      setMaterials(mats)
    } catch (err: any) {
      console.error('Erro ao carregar dados de divergências:', err)
      setFeedbackMessage({ type: 'error', text: err.message || 'Falha ao carregar divergências.' })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDetail = async (div: DivergenceWithDetails) => {
    setSelectedDivergence(div)
    setIsDetailOpen(true)
    setActionType('NONE')
    setActionNotes('')
    setContestReason('')
    setLossReason(`Perda apurada referente à divergência ${div.type} de ${div.difference_qty} peças.`)

    // Load full details including history and losses
    const full = await divergenceService.getDivergenceById(div.id)
    if (full) {
      setSelectedDivergence(full)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    if (selectedDivergence) {
      const full = await divergenceService.getDivergenceById(selectedDivergence.id)
      if (full) setSelectedDivergence(full)
    }
  }

  // Action Handlers
  const handleStartAnalysis = async () => {
    if (!selectedDivergence) return
    try {
      setIsSubmittingAction(true)
      await divergenceService.startAnalysis(selectedDivergence.id)
      setFeedbackMessage({ type: 'success', text: 'Análise iniciada com sucesso.' })
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao assumir análise.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleContest = async () => {
    if (!selectedDivergence || !contestReason.trim()) return
    try {
      setIsSubmittingAction(true)
      await divergenceService.contestDivergence(selectedDivergence.id, contestReason.trim())
      setFeedbackMessage({ type: 'success', text: 'Divergência contestada com sucesso.' })
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao contestar divergência.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleResolveMissingFound = async () => {
    if (!selectedDivergence) return
    try {
      setIsSubmittingAction(true)
      const res = await divergenceService.resolveMissingFound(
        selectedDivergence.id,
        actionNotes || 'Material faltante localizado e integrado fisicamente ao estoque de destino.'
      )
      setFeedbackMessage({ type: 'success', text: res.message || 'Faltante reconciliado com sucesso.' })
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao reconciliar faltante.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleConfirmMissingLoss = async () => {
    if (!selectedDivergence) return
    try {
      setIsSubmittingAction(true)
      const res = await divergenceService.confirmMissingLoss(
        selectedDivergence.id,
        actionNotes || 'Falta física confirmada administrativamente e baixada do trânsito.'
      )
      setFeedbackMessage({ type: 'success', text: res.message || 'Falta física confirmada e baixada.' })
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao confirmar falta física.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleCloseWithoutLoss = async () => {
    if (!selectedDivergence) return
    try {
      setIsSubmittingAction(true)
      const res = await divergenceService.closeWithoutLoss(
        selectedDivergence.id,
        actionNotes || 'Encerrado administrativamente sem apuração de perda financeira.'
      )
      setFeedbackMessage({ type: 'success', text: res.message || 'Divergência encerrada.' })
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao encerrar divergência.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleCreateLoss = async () => {
    if (!selectedDivergence || !selectedDivergence.material_id) return
    try {
      setIsSubmittingAction(true)
      const diffQty = Math.abs(Number(selectedDivergence.difference_qty || 0))
      const remainingQty = diffQty - Number(selectedDivergence.allocated_loss_qty || 0)

      if (remainingQty <= 0) {
        throw new Error('A quantidade total desta divergência já foi alocada em perdas financeiras.')
      }

      const res = await lossService.createLoss({
        divergenceId: selectedDivergence.id,
        workId: selectedDivergence.load?.origin_location_id || selectedDivergence.load?.destination_location_id,
        supplierId: selectedDivergence.load?.destination_location?.type === 'FORNECEDOR' ? selectedDivergence.load.destination_location_id : null,
        materialId: selectedDivergence.material_id,
        quantity: remainingQty,
        responsibleType: lossResponsibleType,
        responsibleReferenceId: lossResponsibleId || null,
        reason: lossReason || 'Perda gerada a partir da divergência de conferência.',
      })

      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Perda financeira registrada e vinculada com sucesso.',
      })
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao registrar perda financeira.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedDivergence || !actionNotes.trim()) return
    try {
      setIsSubmittingAction(true)
      await divergenceService.addNote(selectedDivergence.id, actionNotes.trim())
      setFeedbackMessage({ type: 'success', text: 'Observação registrada no histórico.' })
      setActionNotes('')
      setActionType('NONE')
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao adicionar nota.' })
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const openPhoto = async (photo: any) => {
    if (photo.storage_path.startsWith('http') || photo.storage_path.startsWith('blob')) {
      setSelectedPhotoUrl(photo.storage_path)
    } else {
      const url = await conferenceService.getSignedPhotoUrl(photo.storage_path)
      setSelectedPhotoUrl(url)
    }
  }

  // Filter computation
  const filteredDivergences = divergences.filter((d) => {
    const matchesSearch =
      (d.material?.name && d.material.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.material?.code && d.material.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.pallet?.code && d.pallet.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.load?.code && d.load.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
    const matchesType = typeFilter === 'ALL' || d.type === typeFilter
    const matchesMaterial = materialFilter === 'ALL' || d.material_id === materialFilter
    const matchesLocation =
      locationFilter === 'ALL' ||
      d.load?.origin_location_id === locationFilter ||
      d.load?.destination_location_id === locationFilter

    const matchesDate =
      (!startDate || new Date(d.created_at) >= new Date(`${startDate}T00:00:00Z`)) &&
      (!endDate || new Date(d.created_at) <= new Date(`${endDate}T23:59:59Z`))

    return matchesSearch && matchesStatus && matchesType && matchesMaterial && matchesLocation && matchesDate
  })

  // Metrics
  const totalCount = divergences.length
  const pendingCount = divergences.filter((d) => d.status === 'PENDENTE').length
  const analysisCount = divergences.filter((d) => d.status === 'EM_ANALISE').length
  const contestedCount = divergences.filter((d) => d.status === 'CONTESTADA').length
  const resolvedCount = divergences.filter((d) => d.status === 'RESOLVIDA').length

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FALTANTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <TrendingDown className="w-3 h-3" /> Faltante
          </span>
        )
      case 'EXCEDENTE_DE_ORIGEM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <TrendingUp className="w-3 h-3" /> Excedente
          </span>
        )
      case 'MATERIAL_DIFERENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Layers className="w-3 h-3" /> Mat. Diferente
          </span>
        )
      case 'SUCATA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
            <AlertOctagon className="w-3 h-3" /> Sucata
          </span>
        )
      case 'PALLET_DANIFICADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-3 h-3" /> Pallet Danificado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <HelpCircle className="w-3 h-3" /> {type}
          </span>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        )
      case 'EM_ANALISE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <ShieldAlert className="w-3 h-3" /> Em Análise
          </span>
        )
      case 'CONTESTADA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60">
            <AlertTriangle className="w-3 h-3" /> Contestada
          </span>
        )
      case 'RESOLVIDA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" /> Resolvida
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {status}
          </span>
        )
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando central de divergências e conferências..." />
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            Central de Divergências
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Tratativa administrativa, reconciliação física e auditoria de ocorrências identificadas na conferência
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          {onNavigateToLosses && (
            <button
              onClick={onNavigateToLosses}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-sm font-medium text-white dark:text-zinc-900 flex items-center gap-2 transition-colors shadow-xs"
            >
              <DollarSign className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              Ver Perdas Financeiras
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Ocorrências</span>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs bg-amber-50/20 dark:bg-amber-950/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Pendentes
          </span>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-blue-200/80 dark:border-blue-900/40 p-4 shadow-xs bg-blue-50/20 dark:bg-blue-950/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Em Análise
          </span>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{analysisCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-orange-200/80 dark:border-orange-900/40 p-4 shadow-xs bg-orange-50/20 dark:bg-orange-950/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            Contestadas
          </span>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">{contestedCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xs bg-emerald-50/20 dark:bg-emerald-950/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Resolvidas
          </span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por material, código do pallet, manifesto ou observação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="EM_ANALISE">Em Análise</option>
              <option value="CONTESTADA">Contestadas</option>
              <option value="RESOLVIDA">Resolvidas</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="FALTANTE">Faltante</option>
              <option value="EXCEDENTE_DE_ORIGEM">Excedente de Origem</option>
              <option value="MATERIAL_DIFERENTE">Material Diferente</option>
              <option value="SUCATA">Sucata</option>
              <option value="PALLET_DANIFICADO">Pallet Danificado</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Local:</span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">Todas as Localizações</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Material:</span>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate"
            >
              <option value="ALL">Todos os Materiais</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            />
            <span>Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            />
            {(startDate || endDate || locationFilter !== 'ALL' || materialFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setLocationFilter('ALL')
                  setMaterialFilter('ALL')
                }}
                className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Divergences Table */}
      {filteredDivergences.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma divergência encontrada"
          description="Nenhuma ocorrência atende aos filtros selecionados ou todas as conferências foram limpas."
        />
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Tipo & Status</th>
                  <th className="py-3 px-4">Material / Peça</th>
                  <th className="py-3 px-4">Carga / Pallet</th>
                  <th className="py-3 px-4">Origem → Destino</th>
                  <th className="py-3 px-4 text-center">Manifestado</th>
                  <th className="py-3 px-4 text-center">Conferido</th>
                  <th className="py-3 px-4 text-center">Divergência</th>
                  <th className="py-3 px-4 text-center">Evidências</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {filteredDivergences.map((div) => {
                  const hasPhotos = div.photos && div.photos.length > 0
                  const isLossAllocated = Number(div.allocated_loss_qty || 0) > 0

                  return (
                    <tr
                      key={div.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Tipo & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {getTypeBadge(div.type)}
                          {getStatusBadge(div.status)}
                        </div>
                      </td>

                      {/* Material */}
                      <td className="py-3.5 px-4">
                        {div.material ? (
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                              {div.material.code}
                            </span>
                            <span className="text-xs text-zinc-500 line-clamp-1">{div.material.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Não vinculado a catálogo</span>
                        )}
                      </td>

                      {/* Carga / Pallet */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs">
                          {div.load && (
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
                              Carga: {div.load.code}
                            </span>
                          )}
                          {div.pallet ? (
                            <span className="text-zinc-500">Pallet: {div.pallet.code}</span>
                          ) : (
                            <span className="text-zinc-400 italic">Avulso</span>
                          )}
                        </div>
                      </td>

                      {/* Origem -> Destino */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="font-medium">{div.load?.origin_location?.name || 'Origem'}</span>
                          <span className="text-zinc-400 mx-1">→</span>
                          <span className="font-medium">{div.load?.destination_location?.name || 'Destino'}</span>
                        </div>
                      </td>

                      {/* Manifestado */}
                      <td className="py-3.5 px-4 text-center font-medium text-zinc-600 dark:text-zinc-400">
                        {div.expected_qty !== null ? div.expected_qty : '—'}
                      </td>

                      {/* Conferido */}
                      <td className="py-3.5 px-4 text-center font-medium text-zinc-900 dark:text-zinc-100">
                        {div.received_qty !== null ? div.received_qty : '—'}
                      </td>

                      {/* Divergência (Diferença) */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            Number(div.difference_qty || 0) > 0 && div.type === 'FALTANTE'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {Number(div.difference_qty || 0) > 0 ? `-${div.difference_qty}` : `+${Math.abs(Number(div.difference_qty || 0))}`}
                        </span>
                        {isLossAllocated && (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                            Perda: {div.allocated_loss_qty} un
                          </span>
                        )}
                      </td>

                      {/* Evidências */}
                      <td className="py-3.5 px-4 text-center">
                        {hasPhotos ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              <Camera className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              {div.photos?.length} foto(s)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(div)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs"
                        >
                          Tratar / Detalhes
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: TRATATIVA DA DIVERGÊNCIA */}
      {/* ========================================================================= */}
      {isDetailOpen && selectedDivergence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                    Tratativa de Ocorrência #{selectedDivergence.id.slice(0, 8)}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getTypeBadge(selectedDivergence.type)}
                    {getStatusBadge(selectedDivergence.status)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Conference Original Data Snapshot */}
              <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Dados Originais da Conferência Física
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-zinc-400 block">Material:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedDivergence.material?.code || '—'}
                    </span>
                    <span className="text-xs text-zinc-500 block truncate">
                      {selectedDivergence.material?.name || 'Material não identificado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-zinc-400 block">Carga & Pallet:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedDivergence.load?.code || 'Carga N/A'}
                    </span>
                    <span className="text-xs text-zinc-500 block">
                      {selectedDivergence.pallet?.code || 'Pallet avulso'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-zinc-400 block">Manifestado vs Recebido:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedDivergence.expected_qty ?? '—'} un → {selectedDivergence.received_qty ?? '—'} un
                    </span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                      Diferença: {selectedDivergence.difference_qty} un
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-zinc-400 block">Data de Registro:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {new Date(selectedDivergence.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-zinc-500 block">
                      {new Date(selectedDivergence.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {selectedDivergence.notes && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400">Observação do Conferente: </span>
                    <span className="text-zinc-800 dark:text-zinc-200 italic">{selectedDivergence.notes}</span>
                  </div>
                )}
              </div>

              {/* Photos Gallery */}
              {selectedDivergence.photos && selectedDivergence.photos.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-500" />
                    Fotos & Evidências Anexadas ({selectedDivergence.photos.length})
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedDivergence.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => openPhoto(photo)}
                        className="group relative w-24 h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:ring-2 hover:ring-blue-500 transition-all"
                      >
                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Specific Info */}
              {selectedDivergence.status === 'CONTESTADA' && selectedDivergence.contest_reason && (
                <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 text-xs text-orange-900 dark:text-orange-200 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-orange-800 dark:text-orange-300">
                    <AlertTriangle className="w-3.5 h-3.5" /> Motivo da Contestação Administrativa:
                  </span>
                  <p>{selectedDivergence.contest_reason}</p>
                </div>
              )}

              {selectedDivergence.status === 'RESOLVIDA' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolução Concluída ({selectedDivergence.resolution_type || 'OFICIAL'}):
                  </span>
                  <p>{selectedDivergence.resolution_notes || 'Sem observações adicionais.'}</p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ACTION PANELS */}
              {/* ========================================================================= */}
              {canAdministrate && selectedDivergence.status !== 'RESOLVIDA' && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 bg-zinc-50/40 dark:bg-zinc-800/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Ações Administrativas & Reconciliação
                    </h3>
                    {selectedDivergence.status === 'PENDENTE' && (
                      <button
                        onClick={handleStartAnalysis}
                        disabled={isSubmittingAction}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        Assumir Análise
                      </button>
                    )}
                  </div>

                  {/* Action Selection Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedDivergence.type === 'FALTANTE' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActionType('RESOLVE_FOUND')}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            actionType === 'RESOLVE_FOUND'
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 font-semibold text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reconciliar Localizado
                          </div>
                          <span className="text-[11px] text-zinc-500 mt-0.5 block">
                            Peça encontrada: entra no estoque físico e baixa o trânsito.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionType('CONFIRM_MISSING')}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            actionType === 'CONFIRM_MISSING'
                              ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 font-semibold text-rose-900 dark:text-rose-200 ring-2 ring-rose-500'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                            <AlertOctagon className="w-3.5 h-3.5" /> Confirmar Falta Física
                          </div>
                          <span className="text-[11px] text-zinc-500 mt-0.5 block">
                            Baixa o saldo de trânsito (não entra no destino).
                          </span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setActionType('CREATE_LOSS')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        actionType === 'CREATE_LOSS'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 font-semibold text-blue-900 dark:text-blue-200 ring-2 ring-blue-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                        <DollarSign className="w-3.5 h-3.5" /> Gerar Perda Financeira
                      </div>
                      <span className="text-[11px] text-zinc-500 mt-0.5 block">
                        Apurar valor de indenização por m² da obra/tabela.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActionType('CONTEST')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        actionType === 'CONTEST'
                          ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/40 font-semibold text-orange-900 dark:text-orange-200 ring-2 ring-orange-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                        <AlertTriangle className="w-3.5 h-3.5" /> Contestar Divergência
                      </div>
                      <span className="text-[11px] text-zinc-500 mt-0.5 block">
                        Registrar motivo de desacordo entre partes.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActionType('CLOSE_WITHOUT_LOSS')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        actionType === 'CLOSE_WITHOUT_LOSS'
                          ? 'border-zinc-600 bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 ring-2 ring-zinc-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <Check className="w-3.5 h-3.5" /> Encerrar sem Perda
                      </div>
                      <span className="text-[11px] text-zinc-500 mt-0.5 block">
                        Fechar ocorrência administrativamente.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActionType('ADD_NOTE')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        actionType === 'ADD_NOTE'
                          ? 'border-zinc-600 bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 ring-2 ring-zinc-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <MessageSquare className="w-3.5 h-3.5" /> Nota de Auditoria
                      </div>
                      <span className="text-[11px] text-zinc-500 mt-0.5 block">
                        Registrar andamento sem alterar status.
                      </span>
                    </button>
                  </div>

                  {/* Action Form Inputs */}
                  {actionType === 'CONTEST' && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Motivo da Contestação (Obrigatório):
                      </label>
                      <textarea
                        value={contestReason}
                        onChange={(e) => setContestReason(e.target.value)}
                        placeholder="Descreva por que esta divergência está sendo contestada..."
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        onClick={handleContest}
                        disabled={isSubmittingAction || !contestReason.trim()}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Confirmar Contestação
                      </button>
                    </div>
                  )}

                  {actionType === 'RESOLVE_FOUND' && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Observação de Reconciliação (Opcional):
                      </label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Ex: Peça encontrada após conferência e guardada no galpão..."
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleResolveMissingFound}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Executar Reconciliação Física & Resolver
                      </button>
                    </div>
                  )}

                  {actionType === 'CONFIRM_MISSING' && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Observação da Baixa de Trânsito:
                      </label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Ex: Falta confirmada após buscas na obra e caminhão..."
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        onClick={handleConfirmMissingLoss}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Confirmar Baixa Física & Resolver
                      </button>
                    </div>
                  )}

                  {actionType === 'CLOSE_WITHOUT_LOSS' && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Justificativa de Encerramento sem Perda:
                      </label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Ex: Divergência aceita entre as partes sem impacto financeiro..."
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500"
                      />
                      <button
                        onClick={handleCloseWithoutLoss}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-200 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Encerrar Ocorrência
                      </button>
                    </div>
                  )}

                  {actionType === 'CREATE_LOSS' && (
                    <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                            Responsável:
                          </label>
                          <select
                            value={lossResponsibleType}
                            onChange={(e) => setLossResponsibleType(e.target.value as any)}
                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="OBRA">Obra</option>
                            <option value="FORNECEDOR">Fornecedor</option>
                            <option value="TRANSPORTADORA">Transportadora</option>
                            <option value="INTERNO">Interno / Empresa</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                            Localização / Referência:
                          </label>
                          <select
                            value={lossResponsibleId}
                            onChange={(e) => setLossResponsibleId(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="">Selecione o local responsável...</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({loc.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                          Motivo / Justificativa da Perda:
                        </label>
                        <textarea
                          value={lossReason}
                          onChange={(e) => setLossReason(e.target.value)}
                          placeholder="Motivo detalhado da apuração de responsabilidade..."
                          rows={2}
                          className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100"
                        />
                      </div>

                      <button
                        onClick={handleCreateLoss}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Registrar Perda Financeira (Cálculo Automático por m²)
                      </button>
                    </div>
                  )}

                  {actionType === 'ADD_NOTE' && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Nova Observação de Auditoria:
                      </label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="Ex: Entrado em contato com o supervisor da obra para esclarecimento..."
                        rows={2}
                        className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={isSubmittingAction || !actionNotes.trim()}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Salvar Nota no Histórico
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* History Timeline */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-400" />
                  Trilha de Auditoria & Histórico de Ações
                </h3>

                {selectedDivergence.history && selectedDivergence.history.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedDivergence.history.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800 text-xs"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {h.action}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {new Date(h.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(h.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {h.notes && <p className="text-zinc-600 dark:text-zinc-400 mt-1">{h.notes}</p>}
                          {h.performer && (
                            <span className="text-[10px] text-zinc-400 block mt-1">
                              Por: {h.performer.full_name || h.performer.email} ({h.performer.system_role})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Nenhum evento registrado no histórico.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end bg-zinc-50/50 dark:bg-zinc-800/30">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhotoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhotoUrl}
              alt="Evidência fotográfica"
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
