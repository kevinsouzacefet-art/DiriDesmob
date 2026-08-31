import React, { useState, useEffect } from 'react'
import { conferenceService } from '../../services/conferenceService'
import { loadService } from '../../services/loadService'
import { materialService } from '../../services/materialService'
import { useAuth } from '../../providers/AuthProvider'
import {
  LoadWithRelations,
  LoadConferenceWithDetails,
  PalletConferenceWithDetails,
  PalletConferenceItemWithDetails,
  Material,
  DivergenceType,
} from '../../types'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Plus,
  Camera,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Truck,
  Building2,
  Warehouse,
  Factory,
  ShieldCheck,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  HelpCircle,
  X,
  Layers,
} from 'lucide-react'
import { LoadingState } from '../../components/common/FeedbackStates'

interface LoadConferencePageProps {
  loadId: string
  onBack: () => void
  onNavigateToLoads?: () => void
}

export const LoadConferencePage: React.FC<LoadConferencePageProps> = ({
  loadId,
  onBack,
  onNavigateToLoads,
}) => {
  const { profile } = useAuth()
  const [load, setLoad] = useState<LoadWithRelations | null>(null)
  const [conference, setConference] = useState<LoadConferenceWithDetails | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedPalletConfId, setSelectedPalletConfId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Modals
  const [isUnexpectedPalletModalOpen, setIsUnexpectedPalletModalOpen] = useState(false)
  const [unexpectedPalletCode, setUnexpectedPalletCode] = useState('')
  const [unexpectedPalletNotes, setUnexpectedPalletNotes] = useState('')

  const [isUnexpectedItemModalOpen, setIsUnexpectedItemModalOpen] = useState(false)
  const [selectedUnexpectedMatId, setSelectedUnexpectedMatId] = useState('')
  const [unexpectedItemQty, setUnexpectedItemQty] = useState<number>(1)

  const [isDivergenceModalOpen, setIsDivergenceModalOpen] = useState(false)
  const [divergenceType, setDivergenceType] = useState<DivergenceType>('PALLET_DANIFICADO')
  const [divergenceMatId, setDivergenceMatId] = useState<string>('')
  const [divergenceExpectedQty, setDivergenceExpectedQty] = useState<number | ''>('')
  const [divergenceReceivedQty, setDivergenceReceivedQty] = useState<number | ''>('')
  const [divergenceNotes, setDivergenceNotes] = useState('')
  const [divergencePhotoFile, setDivergencePhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)

  const fetchConferenceData = async () => {
    try {
      const [loadData, confData, mats] = await Promise.all([
        loadService.getLoadById(loadId),
        conferenceService.getLoadConference(loadId),
        materialService.listMaterials(),
      ])

      setLoad(loadData)
      setConference(confData)
      setMaterials(mats)

      if (confData && confData.pallet_conferences.length > 0) {
        if (!selectedPalletConfId || !confData.pallet_conferences.find((p) => p.id === selectedPalletConfId)) {
          // Select first pending or in-progress pallet
          const inProgress = confData.pallet_conferences.find((p) => p.status === 'EM_ANDAMENTO')
          const pending = confData.pallet_conferences.find((p) => p.status === 'PENDENTE')
          setSelectedPalletConfId(inProgress?.id || pending?.id || confData.pallet_conferences[0].id)
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da conferência:', err)
      setActionError(err.message || 'Erro ao carregar dados da conferência.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConferenceData()
  }, [loadId])

  const selectedPalletConf = conference?.pallet_conferences.find((p) => p.id === selectedPalletConfId)

  // Actions
  const handleStartLoadConference = async () => {
    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await conferenceService.startLoadConference(loadId)
      setActionSuccess('Conferência da carga iniciada com sucesso!')
      await fetchConferenceData()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao iniciar conferência.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartPalletConference = async (palletConfId: string) => {
    setIsProcessing(true)
    setActionError(null)
    try {
      await conferenceService.startPalletConference(palletConfId)
      await fetchConferenceData()
      setSelectedPalletConfId(palletConfId)
    } catch (err: any) {
      setActionError(err.message || 'Erro ao iniciar conferência do pallet.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSetItemQty = async (palletConfId: string, materialId: string, qty: number) => {
    setActionError(null)
    try {
      await conferenceService.setItemReceivedQty(palletConfId, materialId, qty)
      await fetchConferenceData()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao registrar quantidade.')
    }
  }

  const handleAddUnexpectedItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPalletConfId || !selectedUnexpectedMatId || unexpectedItemQty <= 0) return
    setIsProcessing(true)
    setActionError(null)
    try {
      await conferenceService.addUnexpectedItem(
        selectedPalletConfId,
        selectedUnexpectedMatId,
        unexpectedItemQty
      )
      setIsUnexpectedItemModalOpen(false)
      setSelectedUnexpectedMatId('')
      setUnexpectedItemQty(1)
      await fetchConferenceData()
      setActionSuccess('Item não previsto adicionado com sucesso!')
    } catch (err: any) {
      setActionError(err.message || 'Erro ao adicionar item não previsto.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddUnexpectedPallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unexpectedPalletCode.trim()) return
    setIsProcessing(true)
    setActionError(null)
    try {
      const res = await conferenceService.addUnexpectedPallet(
        loadId,
        unexpectedPalletCode.trim(),
        unexpectedPalletNotes
      )
      setIsUnexpectedPalletModalOpen(false)
      setUnexpectedPalletCode('')
      setUnexpectedPalletNotes('')
      await fetchConferenceData()
      if (res.pallet_conference_id) {
        setSelectedPalletConfId(res.pallet_conference_id)
      }
      setActionSuccess('Pallet não previsto registrado na carga!')
    } catch (err: any) {
      setActionError(err.message || 'Erro ao registrar pallet inesperado.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRecordDivergence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPalletConfId) return
    setIsProcessing(true)
    setActionError(null)
    try {
      const exp = divergenceExpectedQty === '' ? undefined : Number(divergenceExpectedQty)
      const rec = divergenceReceivedQty === '' ? undefined : Number(divergenceReceivedQty)
      const res = await conferenceService.recordDivergence(
        selectedPalletConfId,
        divergenceType,
        divergenceMatId || undefined,
        exp,
        rec,
        divergenceNotes
      )

      if (res.divergence_id && divergencePhotoFile) {
        await conferenceService.uploadDiscrepancyPhoto(res.divergence_id, divergencePhotoFile)
      }

      setIsDivergenceModalOpen(false)
      setDivergenceNotes('')
      setDivergencePhotoFile(null)
      setPhotoPreviewUrl(null)
      setDivergenceMatId('')
      setDivergenceExpectedQty('')
      setDivergenceReceivedQty('')
      await fetchConferenceData()
      setActionSuccess('Ocorrência/divergência registrada com sucesso!')
    } catch (err: any) {
      setActionError(err.message || 'Erro ao registrar divergência.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinalizePallet = async (palletConfId: string) => {
    if (!window.confirm('Confirma a conclusão da conferência deste pallet? Os materiais serão integrados ao estoque físico do destino.')) {
      return
    }
    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await conferenceService.finalizePalletConference(palletConfId)
      setActionSuccess('Pallet conferido e estoque físico movimentado com sucesso!')
      await fetchConferenceData()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao finalizar conferência do pallet.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinalizeLoadConference = async () => {
    if (!window.confirm('Confirma a finalização geral da conferência da carga? Todos os pallets estão concluídos.')) {
      return
    }
    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await conferenceService.finalizeLoadConference(loadId)
      setActionSuccess('Conferência geral da carga concluída com sucesso! Status alterado para CONFERIDA.')
      await fetchConferenceData()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao finalizar conferência da carga.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinalizeLoadAdmin = async () => {
    if (!window.confirm('Confirma o arquivamento definitivo da carga como FINALIZADA?')) {
      return
    }
    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await conferenceService.finalizeLoad(loadId)
      setActionSuccess('Carga finalizada administrativamente com sucesso!')
      await fetchConferenceData()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao finalizar carga.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setDivergencePhotoFile(file)
      setPhotoPreviewUrl(URL.createObjectURL(file))
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <LoadingState message="Carregando conferência da carga..." />
      </div>
    )
  }

  if (!load) {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Carga não encontrada</h2>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    )
  }

  const allPalletsCompleted =
    conference &&
    conference.pallet_conferences.length > 0 &&
    conference.pallet_conferences.every((p) => p.status === 'CONCLUIDA')

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {load.code}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Recebimento & Conferência Física
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Conferência pallet a pallet e entrada de estoque no destino
            </p>
          </div>
        </div>

        {/* Load Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              load.status === 'RECEBIDA'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : load.status === 'EM_CONFERENCIA'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                : load.status === 'CONFERIDA'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : load.status === 'FINALIZADA'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {load.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{actionError}</div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 text-emerald-800 dark:text-emerald-200 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{actionSuccess}</div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Overview Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Origem</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-4 h-4 text-zinc-400" />
              {load.origin_location?.name || 'Origem'}
            </div>
            <span className="text-xs text-zinc-400 font-mono">{load.origin_location?.code}</span>
          </div>

          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Destino da Conferência</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <Warehouse className="w-4 h-4 text-emerald-500" />
              {load.destination_location?.name || 'Destino'}
            </div>
            <span className="text-xs text-zinc-400 font-mono">{load.destination_location?.code}</span>
          </div>

          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Veículo / Motorista</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <Truck className="w-4 h-4 text-zinc-400" />
              {load.vehicle_plate || 'Sem placa'}
            </div>
            <span className="text-xs text-zinc-500">{load.driver_name || 'Motorista não informado'}</span>
          </div>

          <div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Progresso dos Pallets</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <Package className="w-4 h-4 text-blue-500" />
              {conference
                ? `${conference.pallet_conferences.filter((p) => p.status === 'CONCLUIDA').length} / ${
                    conference.pallet_conferences.length
                  } concluídos`
                : 'Não iniciada'}
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    conference && conference.pallet_conferences.length > 0
                      ? (conference.pallet_conferences.filter((p) => p.status === 'CONCLUIDA').length /
                          conference.pallet_conferences.length) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* STATE 1: Load is RECEBIDA, conference not started yet */}
      {load.status === 'RECEBIDA' && (!conference || conference.status === 'NAO_INICIADA') && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/60 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Carga Recebida no Pátio de Destino
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              O caminhão chegou ao destino. Inicie a conferência para habilitar a checagem individual pallet a pallet e descarregamento.
            </p>
          </div>
          <button
            onClick={handleStartLoadConference}
            disabled={isProcessing}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 mx-auto transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            {isProcessing ? 'Iniciando...' : 'Iniciar Conferência da Carga'}
          </button>
        </div>
      )}

      {/* STATE 2: Conference in progress (EM_CONFERENCIA) or completed */}
      {conference && (
        <div className="space-y-6">
          {/* Pallet Selection Pills / Mobile Carousel */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-center gap-2 shrink-0">
              {conference.pallet_conferences.map((pc, idx) => {
                const isSelected = pc.id === selectedPalletConfId
                const isCompleted = pc.status === 'CONCLUIDA'
                const isInProgress = pc.status === 'EM_ANDAMENTO'
                const code = pc.pallet?.code || pc.unexpected_code || `Pallet ${idx + 1}`

                return (
                  <button
                    key={pc.id}
                    onClick={() => setSelectedPalletConfId(pc.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                        : isInProgress
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isInProgress ? (
                      <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    ) : (
                      <Package className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    <span>{code}</span>
                    {pc.is_unexpected && (
                      <span className="text-[10px] px-1 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                        Extra
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Add Unexpected Pallet Button */}
            {load.status === 'EM_CONFERENCIA' && (
              <button
                onClick={() => setIsUnexpectedPalletModalOpen(true)}
                className="shrink-0 px-3 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                + Pallet Não Previsto
              </button>
            )}
          </div>

          {/* Active Pallet Detail Card */}
          {selectedPalletConf && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
              {/* Pallet Card Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                        {selectedPalletConf.pallet?.code || selectedPalletConf.unexpected_code || 'Pallet'}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          selectedPalletConf.status === 'CONCLUIDA'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : selectedPalletConf.status === 'EM_ANDAMENTO'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {selectedPalletConf.status}
                      </span>
                      {selectedPalletConf.is_unexpected && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Não previsto na carga
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Previsto: {selectedPalletConf.total_expected_pieces} un | Conferido:{' '}
                      {selectedPalletConf.total_received_pieces} un
                      {selectedPalletConf.total_missing_pieces > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1.5">
                          (Falta: {selectedPalletConf.total_missing_pieces})
                        </span>
                      )}
                      {selectedPalletConf.total_surplus_pieces > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">
                          (Sobra: +{selectedPalletConf.total_surplus_pieces})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Pallet Actions (Start timer, finalize pallet, add unexpected item) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedPalletConf.status === 'PENDENTE' && load.status === 'EM_CONFERENCIA' && (
                    <button
                      onClick={() => handleStartPalletConference(selectedPalletConf.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Iniciar Conferência do Pallet
                    </button>
                  )}

                  {selectedPalletConf.status === 'EM_ANDAMENTO' && (
                    <>
                      <button
                        onClick={() => setIsUnexpectedItemModalOpen(true)}
                        className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Item Não Previsto
                      </button>

                      <button
                        onClick={() => setIsDivergenceModalOpen(true)}
                        className="px-3 py-2 border border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Registrar Ocorrência / Foto
                      </button>

                      <button
                        onClick={() => handleFinalizePallet(selectedPalletConf.id)}
                        disabled={
                          isProcessing ||
                          selectedPalletConf.items.some((it) => it.received_qty === null || !it.is_checked)
                        }
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        title={
                          selectedPalletConf.items.some((it) => it.received_qty === null)
                            ? 'Confira todos os itens antes de concluir o pallet'
                            : ''
                        }
                      >
                        <Check className="w-4 h-4" />
                        Concluir Pallet
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Pallet Items Checklist */}
              <div className="p-4 sm:p-5">
                <div className="space-y-3">
                  {selectedPalletConf.items.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm">
                      Nenhum item vinculado a este pallet. Adicione itens não previstos acima.
                    </div>
                  ) : (
                    selectedPalletConf.items.map((item) => {
                      const isChecked = item.is_checked && item.received_qty !== null
                      const exp = item.expected_qty
                      const rec = item.received_qty

                      let statusBadge = null
                      if (isChecked && rec !== null) {
                        if (rec === exp) {
                          statusBadge = (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Conforme
                            </span>
                          )
                        } else if (rec < exp) {
                          statusBadge = (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Falta ({exp - rec})
                            </span>
                          )
                        } else {
                          statusBadge = (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Sobra (+{rec - exp})
                            </span>
                          )
                        }
                      } else {
                        statusBadge = (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Pendente
                          </span>
                        )
                      }

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                            isChecked
                              ? 'bg-zinc-50/60 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-bold mt-0.5">
                                {item.material?.code || 'MAT'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {item.material?.name || 'Material'}
                                  </h4>
                                  {item.is_unexpected && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
                                      Não previsto
                                    </span>
                                  )}
                                  {statusBadge}
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  {item.material?.width_mm}x{item.material?.height_mm}mm ({item.material?.unit_area_m2}m²)
                                  | Previsto na carga: <strong className="text-zinc-900 dark:text-zinc-100">{exp} un</strong>
                                </p>
                              </div>
                            </div>

                            {/* Receiving Quantity Input / Quick Buttons */}
                            {selectedPalletConf.status === 'EM_ANDAMENTO' ? (
                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetItemQty(
                                        selectedPalletConf.id,
                                        item.material_id,
                                        Math.max(0, (rec || 0) - 1)
                                      )
                                    }
                                    className="px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold transition-colors cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={rec !== null && rec !== undefined ? rec : ''}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                                      if (!isNaN(val)) {
                                        handleSetItemQty(selectedPalletConf.id, item.material_id, val)
                                      }
                                    }}
                                    className="w-16 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 py-1.5 focus:outline-none bg-transparent"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetItemQty(
                                        selectedPalletConf.id,
                                        item.material_id,
                                        (rec || 0) + 1
                                      )
                                    }
                                    className="px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold transition-colors cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetItemQty(selectedPalletConf.id, item.material_id, exp)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                  title="Confirmar quantidade prevista"
                                >
                                  Total ({exp})
                                </button>
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="text-xs text-zinc-500">Conferido:</span>
                                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  {rec !== null ? `${rec} un` : 'Pendente'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Divergences list for active pallet */}
              {selectedPalletConf.divergences && selectedPalletConf.divergences.length > 0 && (
                <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-amber-50/30 dark:bg-amber-950/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ocorrências & Divergências Apontadas neste Pallet
                  </h4>
                  <div className="space-y-2">
                    {selectedPalletConf.divergences.map((div) => (
                      <div
                        key={div.id}
                        className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-300">
                            {div.type.replace(/_/g, ' ')}:
                          </span>{' '}
                          <span className="text-zinc-700 dark:text-zinc-300">{div.notes || 'Sem observações'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 self-start sm:self-auto">
                          {div.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Finalize Load Conference Bar */}
          {allPalletsCompleted && load.status === 'EM_CONFERENCIA' && (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Todos os Pallets Foram Conferidos!
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                O estoque físico de todos os pallets já foi devidamente lançado. Finalize a conferência geral para alterar o status da carga para CONFERIDA.
              </p>
              <button
                onClick={handleFinalizeLoadConference}
                disabled={isProcessing}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm flex items-center gap-2 mx-auto transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                {isProcessing ? 'Finalizando...' : 'Finalizar Conferência Geral da Carga'}
              </button>
            </div>
          )}

          {/* Load is CONFERIDA - Administrative Finalization */}
          {load.status === 'CONFERIDA' && (
            <div className="p-6 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Conferência Concluída (Status: CONFERIDA)
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                A conferência física foi realizada. Você pode arquivar esta carga definitivamente como FINALIZADA.
              </p>
              <button
                onClick={handleFinalizeLoadAdmin}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm shadow-sm flex items-center gap-2 mx-auto transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isProcessing ? 'Processando...' : 'Finalizar Carga (Administrativo)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Unexpected Pallet Modal */}
      {isUnexpectedPalletModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Adicionar Pallet Não Previsto
              </h3>
              <button
                onClick={() => setIsUnexpectedPalletModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUnexpectedPallet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Código / Identificação do Pallet Extra *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PAL-EXTRA-001"
                  value={unexpectedPalletCode}
                  onChange={(e) => setUnexpectedPalletCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold uppercase text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Observações / Motivo
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Pallet identificado na traseira do caminhão sem etiqueta de origem..."
                  value={unexpectedPalletNotes}
                  onChange={(e) => setUnexpectedPalletNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUnexpectedPalletModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !unexpectedPalletCode.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isProcessing ? 'Registrando...' : 'Registrar Pallet Extra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Unexpected Material Item Modal */}
      {isUnexpectedItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Adicionar Material Não Previsto no Pallet
              </h3>
              <button
                onClick={() => setIsUnexpectedItemModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUnexpectedItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Selecione o Material *
                </label>
                <select
                  required
                  value={selectedUnexpectedMatId}
                  onChange={(e) => setSelectedUnexpectedMatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um material...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name} ({m.width_mm}x{m.height_mm}mm)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Quantidade Física Encontrada *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={unexpectedItemQty}
                  onChange={(e) => setUnexpectedItemQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUnexpectedItemModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !selectedUnexpectedMatId || unexpectedItemQty <= 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isProcessing ? 'Adicionando...' : 'Adicionar ao Pallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Pallet Divergence / Discrepancy & Photo Modal */}
      {isDivergenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Registrar Ocorrência / Foto de Avaria
              </h3>
              <button
                onClick={() => setIsDivergenceModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDivergence} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tipo da Ocorrência *
                </label>
                <select
                  required
                  value={divergenceType}
                  onChange={(e) => setDivergenceType(e.target.value as DivergenceType)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PALLET_DANIFICADO">Pallet Danificado / Tombado</option>
                  <option value="SUCATA">Peças Quebradas / Sucata Física</option>
                  <option value="MATERIAL_DIFERENTE">Material Trocado / Incompatível</option>
                  <option value="PALLET_DIFERENTE">Pallet Diferente do Manifesto</option>
                  <option value="OUTRO">Outra Ocorrência Operacional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Material Relacionado (Opcional)
                </label>
                <select
                  value={divergenceMatId}
                  onChange={(e) => setDivergenceMatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Geral / Todo o Pallet</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Qtd Prevista (un)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Opcional"
                    value={divergenceExpectedQty}
                    onChange={(e) =>
                      setDivergenceExpectedQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Qtd Avariada (un)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Opcional"
                    value={divergenceReceivedQty}
                    onChange={(e) =>
                      setDivergenceReceivedQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Detalhes / Descrição do Problema *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Pallet amassado durante o transporte com filme stretch rasgado..."
                  value={divergenceNotes}
                  onChange={(e) => setDivergenceNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Photo Attachment (Discrepancy Photos Bucket) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Foto Comprobatória (Storage Seguro)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-blue-500" />
                    {divergencePhotoFile ? 'Alterar Foto' : 'Tirar ou Escolher Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                  {divergencePhotoFile && (
                    <span className="text-xs text-zinc-500 truncate max-w-[200px]">
                      {divergencePhotoFile.name}
                    </span>
                  )}
                </div>

                {photoPreviewUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 max-h-40 flex items-center justify-center bg-black/5">
                    <img
                      src={photoPreviewUrl}
                      alt="Preview"
                      className="max-h-40 w-auto object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDivergenceModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !divergenceNotes.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {isProcessing ? 'Salvando...' : 'Salvar Ocorrência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
