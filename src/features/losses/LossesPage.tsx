import React, { useState, useEffect } from 'react'
import {
  DollarSign,
  Search,
  Filter,
  Plus,
  FileText,
  Calendar,
  Building2,
  Truck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingDown,
  Layers,
  Check,
  X,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  LossWithDetails,
  LossStatus,
  LossResponsibleType,
  LossMeetingWithDetails,
  LossMeetingStatus,
  Location,
  Material,
  DivergenceWithDetails,
} from '../../types'
import { lossService, CreateLossPayload } from '../../services/lossService'
import { lossMeetingService, CreateMeetingPayload } from '../../services/lossMeetingService'
import { locationService } from '../../services/locationService'
import { materialService } from '../../services/materialService'
import { divergenceService } from '../../services/divergenceService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

export const LossesPage: React.FC = () => {
  const { profile, isAdmin, isAnalyst } = useAuth()
  const canAdministrate = isAdmin || isAnalyst

  const [activeTab, setActiveTab] = useState<'LOSSES' | 'MEETINGS'>('LOSSES')
  const [losses, setLosses] = useState<LossWithDetails[]>([])
  const [meetings, setMeetings] = useState<LossMeetingWithDetails[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [divergences, setDivergences] = useState<DivergenceWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters (Losses)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('ALL')
  const [locationFilter, setLocationFilter] = useState<string>('ALL')
  const [materialFilter, setMaterialFilter] = useState<string>('ALL')

  // Modals
  const [isCreateLossOpen, setIsCreateLossOpen] = useState(false)
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false)
  const [selectedLoss, setSelectedLoss] = useState<LossWithDetails | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<LossMeetingWithDetails | null>(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  // Form states - Create Loss
  const [newLossDivergenceId, setNewLossDivergenceId] = useState<string>('')
  const [newLossMaterialId, setNewLossMaterialId] = useState<string>('')
  const [newLossWorkId, setNewLossWorkId] = useState<string>('')
  const [newLossQuantity, setNewLossQuantity] = useState<number>(1)
  const [newLossResponsibleType, setNewLossResponsibleType] = useState<LossResponsibleType>('OBRA')
  const [newLossResponsibleId, setNewLossResponsibleId] = useState<string>('')
  const [newLossReason, setNewLossReason] = useState<string>('')
  const [previewRate, setPreviewRate] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states - Update Status
  const [editStatus, setEditStatus] = useState<LossStatus>('PENDENTE')
  const [editChargedValue, setEditChargedValue] = useState<string>('')
  const [editAgreementNotes, setEditAgreementNotes] = useState<string>('')

  // Form states - Create Meeting
  const [newMeetingWorkId, setNewMeetingWorkId] = useState<string>('')
  const [newMeetingDate, setNewMeetingDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [newMeetingTitle, setNewMeetingTitle] = useState<string>('Ata de Alinhamento de Perdas e Indenizações')
  const [newMeetingParticipants, setNewMeetingParticipants] = useState<string>('')
  const [newMeetingResponsible, setNewMeetingResponsible] = useState<string>('')
  const [newMeetingDecisions, setNewMeetingDecisions] = useState<string>('')
  const [newMeetingAgreement, setNewMeetingAgreement] = useState<string>('')
  const [newMeetingNotes, setNewMeetingNotes] = useState<string>('')
  const [newMeetingStatus, setNewMeetingStatus] = useState<LossMeetingStatus>('REALIZADA')
  const [selectedLossIdsForMeeting, setSelectedLossIdsForMeeting] = useState<string[]>([])
  const [selectedDivIdsForMeeting, setSelectedDivIdsForMeeting] = useState<string[]>([])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [lList, mList, locList, matList, divList] = await Promise.all([
        lossService.getLosses(),
        lossMeetingService.getMeetings(),
        locationService.getLocations(),
        materialService.listMaterials(),
        divergenceService.getDivergences(),
      ])
      setLosses(lList)
      setMeetings(mList)
      setLocations(locList)
      setMaterials(matList)
      setDivergences(divList)
    } catch (err: any) {
      console.error('Erro ao carregar perdas:', err)
      setFeedbackMessage({ type: 'error', text: err.message || 'Falha ao carregar dados.' })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-fetch preview rate when material or work changes in Create Loss modal
  useEffect(() => {
    if (newLossMaterialId) {
      lossService
        .getLossRate(newLossMaterialId, newLossWorkId || null)
        .then((rate) => setPreviewRate(rate))
        .catch(() => setPreviewRate(null))
    } else {
      setPreviewRate(null)
    }
  }, [newLossMaterialId, newLossWorkId])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
  }

  // Create Loss Submit
  const handleCreateLossSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLossMaterialId || newLossQuantity <= 0 || !newLossReason.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios da perda.' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: CreateLossPayload = {
        divergenceId: newLossDivergenceId || null,
        materialId: newLossMaterialId,
        workId: newLossWorkId || null,
        supplierId: null,
        quantity: newLossQuantity,
        responsibleType: newLossResponsibleType,
        responsibleReferenceId: newLossResponsibleId || null,
        reason: newLossReason.trim(),
      }

      const res = await lossService.createLoss(payload)
      setFeedbackMessage({ type: 'success', text: res.message || 'Perda financeira registrada com sucesso.' })
      setIsCreateLossOpen(false)
      resetLossForm()
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao registrar perda.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetLossForm = () => {
    setNewLossDivergenceId('')
    setNewLossMaterialId('')
    setNewLossWorkId('')
    setNewLossQuantity(1)
    setNewLossResponsibleType('OBRA')
    setNewLossResponsibleId('')
    setNewLossReason('')
    setPreviewRate(null)
  }

  // Update Status Submit
  const handleOpenStatusModal = (loss: LossWithDetails) => {
    setSelectedLoss(loss)
    setEditStatus(loss.status)
    setEditChargedValue(loss.charged_value ? String(loss.charged_value) : '')
    setEditAgreementNotes(loss.agreement_notes || '')
    setIsStatusModalOpen(true)
  }

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoss) return

    try {
      setIsSubmitting(true)
      const charged = editChargedValue ? parseFloat(editChargedValue) : null
      const res = await lossService.updateLossStatus(
        selectedLoss.id,
        editStatus,
        charged,
        editAgreementNotes.trim() || null
      )
      setFeedbackMessage({ type: 'success', text: res.message || 'Status da perda atualizado com sucesso.' })
      setIsStatusModalOpen(false)
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao atualizar status.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Create Meeting Submit
  const handleCreateMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMeetingTitle.trim() || !newMeetingDate) {
      setFeedbackMessage({ type: 'error', text: 'Título e data da reunião são obrigatórios.' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: CreateMeetingPayload = {
        workId: newMeetingWorkId || null,
        meetingDate: newMeetingDate,
        title: newMeetingTitle.trim(),
        participants: newMeetingParticipants.trim() || null,
        responsible: newMeetingResponsible.trim() || null,
        decisions: newMeetingDecisions.trim() || null,
        agreement: newMeetingAgreement.trim() || null,
        notes: newMeetingNotes.trim() || null,
        status: newMeetingStatus,
        lossIds: selectedLossIdsForMeeting,
        divergenceIds: selectedDivIdsForMeeting,
      }

      const res = await lossMeetingService.createMeeting(payload)
      setFeedbackMessage({ type: 'success', text: res.message || 'Ata de reunião registrada com sucesso.' })
      setIsCreateMeetingOpen(false)
      resetMeetingForm()
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao criar ata de reunião.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetMeetingForm = () => {
    setNewMeetingWorkId('')
    setNewMeetingDate(new Date().toISOString().split('T')[0])
    setNewMeetingTitle('Ata de Alinhamento de Perdas e Indenizações')
    setNewMeetingParticipants('')
    setNewMeetingResponsible('')
    setNewMeetingDecisions('')
    setNewMeetingAgreement('')
    setNewMeetingNotes('')
    setNewMeetingStatus('REALIZADA')
    setSelectedLossIdsForMeeting([])
    setSelectedDivIdsForMeeting([])
  }

  // Metrics computation
  const totalLossCalculated = losses.reduce((acc, l) => acc + Number(l.calculated_value || 0), 0)
  const approvedLossValue = losses
    .filter((l) => ['APROVADA', 'COBRADA', 'PAGA'].includes(l.status))
    .reduce((acc, l) => acc + Number(l.calculated_value || 0), 0)
  const pendingLossValue = losses
    .filter((l) => ['PENDENTE', 'EM_NEGOCIACAO'].includes(l.status))
    .reduce((acc, l) => acc + Number(l.calculated_value || 0), 0)
  const totalChargedValue = losses.reduce((acc, l) => acc + Number(l.charged_value || 0), 0)

  // Filtered losses
  const filteredLosses = losses.filter((l) => {
    const matchesSearch =
      (l.material?.name && l.material.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.material?.code && l.material.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.reason && l.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.work?.name && l.work.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter
    const matchesResponsible = responsibleFilter === 'ALL' || l.responsible_type === responsibleFilter
    const matchesLocation =
      locationFilter === 'ALL' || l.work_id === locationFilter || l.responsible_reference_id === locationFilter
    const matchesMaterial = materialFilter === 'ALL' || l.material_id === materialFilter

    return matchesSearch && matchesStatus && matchesResponsible && matchesLocation && matchesMaterial
  })

  const getLossStatusBadge = (status: LossStatus) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        )
      case 'EM_NEGOCIACAO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Flame className="w-3 h-3" /> Em Negociação
          </span>
        )
      case 'APROVADA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Aprovada
          </span>
        )
      case 'COBRADA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <DollarSign className="w-3 h-3" /> Cobrada
          </span>
        )
      case 'PAGA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
            <Check className="w-3 h-3" /> Paga
          </span>
        )
      case 'ABSORVIDA_PELA_EMPRESA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
            Absorvida
          </span>
        )
      default:
        return <span className="text-xs">{status}</span>
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando perdas financeiras e reuniões de alinhamento..." />
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
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
            Perdas Financeiras & Reuniões de Alinhamento
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gestão de responsabilidades, cálculo por m² via tabela de indenização e atas de conciliação
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

          {canAdministrate && activeTab === 'LOSSES' && (
            <button
              onClick={() => {
                resetLossForm()
                setIsCreateLossOpen(true)
              }}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white flex items-center gap-2 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nova Perda Financeira
            </button>
          )}

          {canAdministrate && activeTab === 'MEETINGS' && (
            <button
              onClick={() => {
                resetMeetingForm()
                setIsCreateMeetingOpen(true)
              }}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white flex items-center gap-2 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nova Ata de Reunião
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('LOSSES')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'LOSSES'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Perdas Financeiras ({losses.length})
        </button>

        <button
          onClick={() => setActiveTab('MEETINGS')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'MEETINGS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Atas de Reuniões de Perdas ({meetings.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERDAS FINANCEIRAS */}
      {/* ========================================================================= */}
      {activeTab === 'LOSSES' && (
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Apurado</span>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                R$ {totalLossCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs bg-amber-50/20 dark:bg-amber-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pendente / Negociação
              </span>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                R$ {pendingLossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xs bg-emerald-50/20 dark:bg-emerald-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Perdas Aprovadas
              </span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                R$ {approvedLossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-purple-200/80 dark:border-purple-900/40 p-4 shadow-xs bg-purple-50/20 dark:bg-purple-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Valor Cobrado
              </span>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                R$ {totalChargedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por material, motivo, obra ou responsável..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300"
              >
                <option value="ALL">Todos os Status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_NEGOCIACAO">Em Negociação</option>
                <option value="APROVADA">Aprovada</option>
                <option value="COBRADA">Cobrada</option>
                <option value="PAGA">Paga</option>
                <option value="ABSORVIDA_PELA_EMPRESA">Absorvida</option>
              </select>

              <select
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300"
              >
                <option value="ALL">Todos os Responsáveis</option>
                <option value="OBRA">Obra</option>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="TRANSPORTADORA">Transportadora</option>
                <option value="INTERNO">Interno / Empresa</option>
              </select>
            </div>
          </div>

          {/* Losses Table */}
          {filteredLosses.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma perda financeira encontrada"
              description="Nenhum registro atende aos filtros atuais."
            />
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Material / Peça</th>
                      <th className="py-3 px-4">Responsável & Motivo</th>
                      <th className="py-3 px-4 text-center">Qtd & Área</th>
                      <th className="py-3 px-4 text-right">Taxa Aplicada</th>
                      <th className="py-3 px-4 text-right">Valor Calculado</th>
                      <th className="py-3 px-4 text-right">Valor Cobrado</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    {filteredLosses.map((loss) => {
                      const totalArea = Number(loss.quantity) * Number(loss.unit_area_m2_snapshot || 1)

                      return (
                        <tr
                          key={loss.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          {/* Material */}
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                                {loss.material?.code || '—'}
                              </span>
                              <span className="text-xs text-zinc-500 line-clamp-1">
                                {loss.material?.name || 'Material'}
                              </span>
                            </div>
                          </td>

                          {/* Responsável & Motivo */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                                {loss.responsible_type}: {loss.responsible_location?.name || loss.work?.name || '—'}
                              </span>
                              <p className="text-zinc-500 line-clamp-1 mt-0.5">{loss.reason}</p>
                            </div>
                          </td>

                          {/* Qtd & Área */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                              {loss.quantity} un
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              {totalArea.toFixed(2)} m² ({loss.unit_area_m2_snapshot} m²/un)
                            </span>
                          </td>

                          {/* Taxa Aplicada */}
                          <td className="py-3.5 px-4 text-right font-medium text-zinc-600 dark:text-zinc-400">
                            R$ {Number(loss.applied_rate_per_m2 || 0).toFixed(2)} / m²
                          </td>

                          {/* Valor Calculado */}
                          <td className="py-3.5 px-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                            R$ {Number(loss.calculated_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Valor Cobrado */}
                          <td className="py-3.5 px-4 text-right">
                            {loss.charged_value !== null ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                R$ {Number(loss.charged_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400 italic">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {getLossStatusBadge(loss.status)}
                          </td>

                          {/* Ação */}
                          <td className="py-3.5 px-4 text-right">
                            {canAdministrate && (
                              <button
                                onClick={() => handleOpenStatusModal(loss)}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                              >
                                Tratar Status
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REUNIÕES & ATAS DE PERDAS */}
      {/* ========================================================================= */}
      {activeTab === 'MEETINGS' && (
        <div className="space-y-6">
          {meetings.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhuma ata de reunião registrada"
              description="Registre alinhamentos periódicos entre Obra, Fornecedor e Galpão para conciliação de perdas."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">
                          {m.work?.name || 'Geral / Múltiplas Obras'}
                        </span>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base mt-0.5">
                          {m.title}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        {m.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Data: {new Date(m.meeting_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {m.participants && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Participantes: {m.participants}</span>
                        </div>
                      )}
                    </div>

                    {m.decisions && (
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-0.5">
                          Decisões / Acordo:
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400">{m.decisions}</p>
                        {m.agreement && (
                          <p className="text-zinc-800 dark:text-zinc-200 font-semibold mt-1">
                            Acordo financeiro: {m.agreement}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      {m.losses?.length || 0} perda(s) | {m.divergences?.length || 0} divergência(s) vinculada(s)
                    </span>
                    <button
                      onClick={() => setSelectedMeeting(m)}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver Ata Completa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA PERDA FINANCEIRA */}
      {/* ========================================================================= */}
      {isCreateLossOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Registrar Perda Financeira
              </h2>
              <button onClick={() => setIsCreateLossOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLossSubmit} className="space-y-4 text-xs">
              {/* Divergence link (optional) */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Vincular a Divergência de Conferência (Opcional):
                </label>
                <select
                  value={newLossDivergenceId}
                  onChange={(e) => {
                    setNewLossDivergenceId(e.target.value)
                    const div = divergences.find((d) => d.id === e.target.value)
                    if (div) {
                      if (div.material_id) setNewLossMaterialId(div.material_id)
                      if (div.difference_qty) setNewLossQuantity(Math.abs(Number(div.difference_qty)))
                      if (div.load?.origin_location_id) setNewLossWorkId(div.load.origin_location_id)
                    }
                  }}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Nenhuma (Registro Avulso)</option>
                  {divergences.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.id.slice(0, 8)} - {d.type} ({d.difference_qty} un) - {d.material?.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Material / Peça (Obrigatório):
                </label>
                <select
                  value={newLossMaterialId}
                  onChange={(e) => setNewLossMaterialId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecione o material...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name} ({m.unit_area_m2} m²)
                    </option>
                  ))}
                </select>
              </div>

              {/* Work */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Obra de Origem / Referência:
                </label>
                <select
                  value={newLossWorkId}
                  onChange={(e) => setNewLossWorkId(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecione a obra...</option>
                  {locations
                    .filter((l) => l.type === 'OBRA')
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Quantidade (peças):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newLossQuantity}
                    onChange={(e) => setNewLossQuantity(parseInt(e.target.value) || 1)}
                    required
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Taxa Calculada:
                  </label>
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-bold">
                    {previewRate !== null ? `R$ ${previewRate.toFixed(2)} / m²` : 'Sem taxa ativa cadastrada'}
                  </div>
                </div>
              </div>

              {/* Responsible Type & Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Tipo de Responsável:
                  </label>
                  <select
                    value={newLossResponsibleType}
                    onChange={(e) => setNewLossResponsibleType(e.target.value as any)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="OBRA">Obra</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="TRANSPORTADORA">Transportadora</option>
                    <option value="INTERNO">Interno / Empresa</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Local Responsável:
                  </label>
                  <select
                    value={newLossResponsibleId}
                    onChange={(e) => setNewLossResponsibleId(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Selecione...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Motivo / Justificativa (Obrigatório):
                </label>
                <textarea
                  value={newLossReason}
                  onChange={(e) => setNewLossReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Descreva o motivo da perda, contexto e apontamento de responsabilidade..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateLossOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || previewRate === null}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Perda Financeira'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TRATAR STATUS DA PERDA */}
      {/* ========================================================================= */}
      {isStatusModalOpen && selectedLoss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Atualizar Status da Perda #{selectedLoss.id.slice(0, 8)}
              </h2>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Novo Status:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as LossStatus)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-medium"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_NEGOCIACAO">Em Negociação</option>
                  <option value="APROVADA">Aprovada</option>
                  <option value="COBRADA">Cobrada</option>
                  <option value="PAGA">Paga</option>
                  <option value="ABSORVIDA_PELA_EMPRESA">Absorvida pela Empresa</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Valor Cobrado / Acordado (R$):
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={String(selectedLoss.calculated_value)}
                  value={editChargedValue}
                  onChange={(e) => setEditChargedValue(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Observações do Acordo / Conciliação:
                </label>
                <textarea
                  value={editAgreementNotes}
                  onChange={(e) => setEditAgreementNotes(e.target.value)}
                  rows={3}
                  placeholder="Detalhes da negociação, número de nota de débito ou desconto acordado..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA ATA DE REUNIÃO */}
      {/* ========================================================================= */}
      {isCreateMeetingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Nova Ata de Reunião de Perdas
              </h2>
              <button onClick={() => setIsCreateMeetingOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeetingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Obra de Referência:
                  </label>
                  <select
                    value={newMeetingWorkId}
                    onChange={(e) => setNewMeetingWorkId(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Geral / Sem obra fixa</option>
                    {locations
                      .filter((l) => l.type === 'OBRA')
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Data da Reunião:
                  </label>
                  <input
                    type="date"
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Título da Reunião / Pauta:
                </label>
                <input
                  type="text"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  required
                  placeholder="Ex: Conciliação de Devoluções e Avarias - Lote #03"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Participantes:
                  </label>
                  <input
                    type="text"
                    value={newMeetingParticipants}
                    onChange={(e) => setNewMeetingParticipants(e.target.value)}
                    placeholder="Ex: Eng. Lucas, Carla (Galpão), Marcos (Fornecedor)"
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Responsável pela Condução:
                  </label>
                  <input
                    type="text"
                    value={newMeetingResponsible}
                    onChange={(e) => setNewMeetingResponsible(e.target.value)}
                    placeholder="Ex: Carla (Galpão Central)"
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Decisões Tomadas:
                </label>
                <textarea
                  value={newMeetingDecisions}
                  onChange={(e) => setNewMeetingDecisions(e.target.value)}
                  rows={2}
                  placeholder="Resumo dos itens acordados em mesa..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Acordo Financeiro / Compensação:
                </label>
                <textarea
                  value={newMeetingAgreement}
                  onChange={(e) => setNewMeetingAgreement(e.target.value)}
                  rows={2}
                  placeholder="Ex: Desconto de R$ 5.000,00 aplicado na fatura de locação do mês subsequente..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Losses Selection */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Vincular Perdas Financeiras Discutidas ({selectedLossIdsForMeeting.length} selecionadas):
                </label>
                <div className="max-h-32 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-1">
                  {losses.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLossIdsForMeeting.includes(l.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLossIdsForMeeting([...selectedLossIdsForMeeting, l.id])
                          } else {
                            setSelectedLossIdsForMeeting(selectedLossIdsForMeeting.filter((id) => id !== l.id))
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                        {l.material?.code} - {l.quantity} un (R$ {Number(l.calculated_value).toFixed(2)}) - {l.reason}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateMeetingOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Ata de Reunião'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALHE DA ATA DE REUNIÃO */}
      {/* ========================================================================= */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {selectedMeeting.work?.name || 'Reunião Geral'}
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedMeeting.title}
                </h2>
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                <div>
                  <span className="text-zinc-400 block">Data da Realização:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {new Date(selectedMeeting.meeting_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Responsável / Moderador:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {selectedMeeting.responsible || '—'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 block">Participantes Presentes:</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {selectedMeeting.participants || '—'}
                  </span>
                </div>
              </div>

              {selectedMeeting.decisions && (
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                    Decisões Firmadas:
                  </span>
                  <p className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {selectedMeeting.decisions}
                  </p>
                </div>
              )}

              {selectedMeeting.agreement && (
                <div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                    Acordo Financeiro & Compensação:
                  </span>
                  <p className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                    {selectedMeeting.agreement}
                  </p>
                </div>
              )}

              {selectedMeeting.losses && selectedMeeting.losses.length > 0 && (
                <div>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                    Perdas Vinculadas ({selectedMeeting.losses.length}):
                  </span>
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {selectedMeeting.losses.map((item) => (
                      <div key={item.id} className="p-2.5 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {item.loss.material?.code}
                          </span>{' '}
                          - {item.loss.quantity} un ({item.loss.reason})
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          R$ {Number(item.loss.calculated_value).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedMeeting(null)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
