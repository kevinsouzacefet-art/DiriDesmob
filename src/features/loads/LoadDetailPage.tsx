import React, { useState, useEffect } from 'react'
import { loadService } from '../../services/loadService'
import { conferenceService } from '../../services/conferenceService'
import { useAuth } from '../../providers/AuthProvider'
import {
  LoadWithRelations,
  DemobilizationPalletWithDetails,
  LoadStatus,
} from '../../types'
import {
  ArrowLeft,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Printer,
  Calendar,
  MapPin,
  Package,
  Layers,
  ShieldAlert,
  Send,
  RotateCcw,
  Edit3,
  ChevronRight,
  Info,
  Building2,
  Warehouse,
  Factory,
} from 'lucide-react'
import { LoadingState } from '../../components/common/FeedbackStates'
import { LoadManifestPrintModal } from './LoadManifestPrintModal'

interface LoadDetailPageProps {
  loadId: string
  onBack: () => void
  onSelectPallet?: (palletId: string) => void
  onNavigateToConference?: (loadId: string) => void
}

export const LoadDetailPage: React.FC<LoadDetailPageProps> = ({
  loadId,
  onBack,
  onSelectPallet,
  onNavigateToConference,
}) => {
  const { profile } = useAuth()
  const [load, setLoad] = useState<LoadWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pallets' | 'materials' | 'transit'>('pallets')

  // Modals & Action States
  const [isAttachPalletModalOpen, setIsAttachPalletModalOpen] = useState(false)
  const [eligiblePallets, setEligiblePallets] = useState<DemobilizationPalletWithDetails[]>([])
  const [selectedPalletIdsToAttach, setSelectedPalletIdsToAttach] = useState<string[]>([])
  const [isAttaching, setIsAttaching] = useState(false)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editPlate, setEditPlate] = useState('')
  const [editDriver, setEditDriver] = useState('')
  const [editCarrier, setEditCarrier] = useState('')
  const [editDepartureDate, setEditDepartureDate] = useState('')
  const [editArrivalDate, setEditArrivalDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [isSavingDetails, setIsSavingDetails] = useState(false)

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const fetchLoad = async () => {
    try {
      const data = await loadService.getLoadById(loadId)
      setLoad(data)
      if (data) {
        setEditPlate(data.vehicle_plate || '')
        setEditDriver(data.driver_name || '')
        setEditCarrier(data.carrier_name || '')
        setEditDepartureDate(data.departure_date || '')
        setEditArrivalDate(data.expected_arrival_date || '')
        setEditNotes(data.notes || '')
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da carga:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLoad()
  }, [loadId])

  const handleOpenAttachModal = async () => {
    if (!load) return
    setIsAttachPalletModalOpen(true)
    setSelectedPalletIdsToAttach([])
    const pallets = await loadService.getEligiblePalletsForOrigin(load.origin_location_id)
    setEligiblePallets(pallets)
  }

  const handleTogglePalletSelection = (pId: string) => {
    setSelectedPalletIdsToAttach((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    )
  }

  const handleAttachPallets = async () => {
    if (!load || selectedPalletIdsToAttach.length === 0) return
    setIsAttaching(true)
    setActionError(null)

    try {
      for (const pId of selectedPalletIdsToAttach) {
        const res = await loadService.attachPalletToLoad(load.id, pId)
        if (!res.success) {
          setActionError(res.error || `Falha ao vincular pallet ${pId}`)
          break
        }
      }
      setIsAttachPalletModalOpen(false)
      fetchLoad()
    } catch (err: any) {
      setActionError(err.message || 'Erro ao vincular pallets.')
    } finally {
      setIsAttaching(false)
    }
  }

  const handleDetachPallet = async (palletId: string) => {
    if (!load) return
    if (!window.confirm('Deseja realmente remover este pallet da carga?')) return

    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await loadService.detachPalletFromLoad(load.id, palletId)
      if (!res.success) {
        setActionError(res.error || 'Falha ao desvincular pallet.')
      } else {
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao desvincular pallet.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!load) return
    setIsSavingDetails(true)
    setActionError(null)

    try {
      const res = await loadService.updateLoadDetails(load.id, {
        vehiclePlate: editPlate.trim() || undefined,
        driverName: editDriver.trim() || undefined,
        carrierName: editCarrier.trim() || undefined,
        departureDate: editDepartureDate || undefined,
        expectedArrivalDate: editArrivalDate || undefined,
        notes: editNotes.trim() || undefined,
      })

      if (!res.success) {
        setActionError(res.error || 'Falha ao atualizar dados.')
      } else {
        setIsEditModalOpen(false)
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao salvar dados.')
    } finally {
      setIsSavingDetails(false)
    }
  }

  const handleMarkReady = async () => {
    if (!load) return
    if (!load.pallets || load.pallets.length === 0) {
      setActionError('Adicione ao menos um pallet antes de marcar como pronta para envio.')
      return
    }

    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await loadService.markLoadReady(load.id)
      if (!res.success) {
        setActionError(res.error || 'Falha ao marcar carga como pronta.')
      } else {
        setActionSuccess('Carga marcada como PRONTA PARA ENVIO com sucesso!')
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao marcar como pronta.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleReopenLoad = async () => {
    if (!load) return
    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await loadService.reopenLoad(load.id)
      if (!res.success) {
        setActionError(res.error || 'Falha ao reabrir carga.')
      } else {
        setActionSuccess('Carga reaberta para Rascunho com sucesso!')
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao reabrir carga.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleDispatchLoad = async () => {
    if (!load) return
    if (
      !window.confirm(
        `CONFIRMAÇÃO DE EXPEDIÇÃO:\n\nDeseja despachar a carga ${load.code}?\n\nIsso moverá atomicamente o saldo de estoque (${load.total_pieces} peças) de RESERVADO na origem para EM TRÂNSITO.`
      )
    ) {
      return
    }

    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await loadService.dispatchLoad(load.id)
      if (!res.success) {
        setActionError(res.error || 'Falha ao despachar carga.')
      } else {
        setActionSuccess(
          `Carga despachada com sucesso! ${res.total_pieces_dispatched || load.total_pieces} peças agora estão EM TRÂNSITO.`
        )
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao despachar carga.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleMarkInTransit = async () => {
    if (!load) return
    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await loadService.markLoadInTransit(load.id)
      if (!res.success) {
        setActionError(res.error || 'Falha ao atualizar para Em Trânsito.')
      } else {
        setActionSuccess('Status da carga atualizado para EM TRÂNSITO.')
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao marcar em trânsito.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleReceiveLoad = async () => {
    if (!load) return
    setIsProcessingAction(true)
    setActionError(null)
    try {
      const res = await conferenceService.receiveLoad(load.id)
      if (!res.success) {
        setActionError(res.message || 'Falha ao receber carga.')
      } else {
        setActionSuccess('Carga recebida no destino com sucesso! Status alterado para RECEBIDA.')
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao receber carga.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleStartConference = async () => {
    if (!load) return
    setIsProcessingAction(true)
    setActionError(null)
    try {
      await conferenceService.startLoadConference(load.id)
      setActionSuccess('Conferência iniciada com sucesso!')
      if (onNavigateToConference) {
        onNavigateToConference(load.id)
      } else {
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao iniciar conferência.')
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleCancelLoad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!load || !cancelReason.trim()) {
      setActionError('O motivo do cancelamento é obrigatório.')
      return
    }

    setIsCancelling(true)
    setActionError(null)
    try {
      const res = await loadService.cancelLoad(load.id, cancelReason.trim())
      if (!res.success) {
        setActionError(res.error || 'Falha ao cancelar carga.')
      } else {
        setIsCancelModalOpen(false)
        setActionSuccess('Carga cancelada com sucesso. Estoque em trânsito estornado se aplicável.')
        fetchLoad()
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao cancelar carga.')
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando detalhes da carga..." />
  }

  if (!load) {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
        <Truck className="w-12 h-12 text-zinc-400 mx-auto" />
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Carga não encontrada</h3>
        <p className="text-xs text-zinc-500">O registro solicitado não existe ou foi removido.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Cargas
        </button>
      </div>
    )
  }

  const isDraft = load.status === 'RASCUNHO'
  const isReady = load.status === 'PRONTA_PARA_ENVIO'
  const isSent = load.status === 'ENVIADA'
  const isInTransit = load.status === 'EM_TRANSITO'
  const isReceived = load.status === 'RECEBIDA'
  const isConferencing = load.status === 'EM_CONFERENCIA'
  const isConferida = load.status === 'CONFERIDA'
  const isFinalized = load.status === 'FINALIZADA'
  const isCancelled = load.status === 'CANCELADA'

  const getLocationIcon = (type?: string) => {
    switch (type) {
      case 'OBRA':
        return <Building2 className="w-4 h-4 text-emerald-500" />
      case 'GALPAO':
        return <Warehouse className="w-4 h-4 text-blue-500" />
      case 'FORNECEDOR':
        return <Factory className="w-4 h-4 text-amber-500" />
      default:
        return <MapPin className="w-4 h-4 text-zinc-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
                {load.code}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {load.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Criada em {new Date(load.created_at).toLocaleString('pt-BR')} por {load.creator?.full_name || 'Sistema'}
            </p>
          </div>
        </div>

        {/* Action Buttons based on Status */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Romaneio Button (always accessible) */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Romaneio
          </button>

          {/* DRAFT ACTIONS */}
          {isDraft && (
            <>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Transporte
              </button>

              <button
                onClick={handleOpenAttachModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Vincular Pallets
              </button>

              <button
                onClick={handleMarkReady}
                disabled={isProcessingAction || !load.pallets || load.pallets.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pronta para Envio
              </button>

              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar
              </button>
            </>
          )}

          {/* READY FOR DISPATCH ACTIONS */}
          {isReady && (
            <>
              <button
                onClick={handleReopenLoad}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reabrir para Rascunho
              </button>

              <button
                onClick={handleDispatchLoad}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Despachar / Expedir Carga
              </button>

              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar
              </button>
            </>
          )}

          {/* SENT ACTIONS */}
          {isSent && (
            <>
              <button
                onClick={handleMarkInTransit}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                <Truck className="w-3.5 h-3.5" />
                Marcar Em Trânsito
              </button>

              {profile?.system_role === 'ADMINISTRADOR' && (
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancelar Carga (Estornar Trânsito)
                </button>
              )}
            </>
          )}

          {/* IN TRANSIT ACTIONS */}
          {isInTransit && (
            <>
              <button
                onClick={handleReceiveLoad}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                Receber Carga no Destino
              </button>

              {profile?.system_role === 'ADMINISTRADOR' && (
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancelar Carga (Estornar Trânsito)
                </button>
              )}
            </>
          )}

          {/* RECEIVED ACTIONS */}
          {isReceived && (
            <>
              <button
                onClick={handleStartConference}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                Iniciar Conferência
              </button>
            </>
          )}

          {/* IN CONFERENCE ACTIONS */}
          {isConferencing && (
            <>
              <button
                onClick={() => onNavigateToConference && onNavigateToConference(load.id)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                Acessar Conferência (Em Andamento)
              </button>
            </>
          )}

          {/* CONFERIDA & FINALIZADA ACTIONS */}
          {(isConferida || isFinalized) && (
            <>
              <button
                onClick={() => onNavigateToConference && onNavigateToConference(load.id)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Ver Conferência & Divergências
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications / Feedback Banners */}
      {actionError && (
        <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Delayed Warning Banner */}
      {load.is_delayed && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Atenção:</strong> A data prevista de chegada (
              {new Date(load.expected_arrival_date || '').toLocaleDateString('pt-BR')}) já foi
              ultrapassada e a carga ainda não foi recebida no destino.
            </span>
          </div>
        </div>
      )}

      {/* Cancellation Notice Banner */}
      {isCancelled && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2 font-bold text-sm">
            <XCircle className="w-4 h-4 text-rose-600" />
            Carga Cancelada Administrativamente
          </div>
          <div>
            <strong>Data do Cancelamento:</strong>{' '}
            {load.cancelled_at ? new Date(load.cancelled_at).toLocaleString('pt-BR') : '—'}
          </div>
          <div>
            <strong>Motivo:</strong> {load.cancellation_reason || 'Nenhum motivo informado'}
          </div>
        </div>
      )}

      {/* Main KPI Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Pallets Embarcados</span>
            <Package className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {load.pallets_count || 0}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Total de Peças</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {load.total_pieces || 0} un
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Área Total</span>
            <FileText className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {load.total_area_m2?.toFixed(2) || '0.00'} m²
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Status da Carga</span>
            <Truck className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
            {load.status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Transport & Route Overview Card */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          Itinerário & Transporte Rodoviário
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Origin Location */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              {getLocationIcon(load.origin_location?.type)}
              Origem da Carga ({load.origin_location?.type})
            </div>
            <div className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {load.origin_location?.name} ({load.origin_location?.code})
            </div>
            <div className="text-xs text-zinc-500">
              {load.origin_location?.city} - {load.origin_location?.state}
            </div>
          </div>

          {/* Destination Location */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              {getLocationIcon(load.destination_location?.type)}
              Destino da Carga ({load.destination_location?.type})
            </div>
            <div className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {load.destination_location?.name} ({load.destination_location?.code})
            </div>
            <div className="text-xs text-zinc-500">
              {load.destination_location?.city} - {load.destination_location?.state}
            </div>
          </div>
        </div>

        {/* Transport Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div>
            <span className="text-zinc-400 font-medium">Placa do Veículo</span>
            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
              {load.vehicle_plate || '—'}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Motorista</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {load.driver_name || '—'}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Transportadora</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {load.carrier_name || '—'}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Data de Saída</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {load.departure_date
                ? new Date(load.departure_date).toLocaleDateString('pt-BR')
                : '—'}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Previsão Chegada</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {load.expected_arrival_date
                ? new Date(load.expected_arrival_date).toLocaleDateString('pt-BR')
                : '—'}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 font-medium">Expedido em</span>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {load.sent_at ? new Date(load.sent_at).toLocaleString('pt-BR') : 'Pendente'}
            </div>
          </div>
          <div className="col-span-2">
            <span className="text-zinc-400 font-medium">Observações</span>
            <div className="text-zinc-600 dark:text-zinc-300">{load.notes || '—'}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('pallets')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pallets'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Pallets da Carga ({load.pallets?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'materials'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Materiais Consolidados ({load.consolidated_materials?.length || 0})
          </button>

          {(isSent || isInTransit) && (
            <button
              onClick={() => setActiveTab('transit')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'transit'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Truck className="w-4 h-4" />
              Estoque em Trânsito ({load.in_transit_balances?.length || 0})
            </button>
          )}
        </nav>
      </div>

      {/* TAB 1: PALLETS LIST */}
      {activeTab === 'pallets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Pallets Vinculados
            </h3>
            {isDraft && (
              <button
                onClick={handleOpenAttachModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Vincular mais pallets
              </button>
            )}
          </div>

          {(!load.pallets || load.pallets.length === 0) ? (
            <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <Package className="w-8 h-8 text-zinc-400 mx-auto" />
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Nenhum pallet vinculado a esta carga
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Vincule pallets que estejam com status PRONTO na localização de origem.
              </p>
              {isDraft && (
                <button
                  onClick={handleOpenAttachModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Vincular Pallets Agora
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {load.pallets.map((p) => (
                <div
                  key={p.id}
                  className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {p.code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {p.status}
                      </span>
                    </div>

                    {isDraft && (
                      <button
                        onClick={() => handleDetachPallet(p.id)}
                        disabled={isProcessingAction}
                        className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Remover pallet da carga"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Items summary */}
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-zinc-500 text-[11px] uppercase tracking-wider">
                      Itens do Pallet:
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {p.items.map((it) => (
                        <div key={it.id} className="py-1 flex items-center justify-between">
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                            {it.material.code} — {it.material.name}
                          </span>
                          <span className="font-mono font-semibold">
                            {it.quantity} un ({it.total_area_m2?.toFixed(2)} m²)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Totals */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-bold">
                    <span className="text-zinc-500">Total: {p.total_pieces} peças</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {p.total_area_m2.toFixed(2)} m²
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONSOLIDATED MATERIALS */}
      {activeTab === 'materials' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Resumo Consolidado da Carga
              </h3>
              <p className="text-xs text-zinc-500">
                Soma total de peças e metragens agrupadas por código de material
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-500">Total Carga: </span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {load.total_pieces || 0} un ({load.total_area_m2?.toFixed(2) || '0.00'} m²)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 text-xs font-semibold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descrição do Material</th>
                  <th className="px-4 py-3 text-right">Área Unitária</th>
                  <th className="px-4 py-3 text-right">Qtd Total Embarcada</th>
                  <th className="px-4 py-3 text-right">Área Total (m²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(load.consolidated_materials || []).map((mat) => (
                  <tr key={mat.material_id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {mat.material_code}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                      {mat.material_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-500 text-xs">
                      {mat.unit_area_m2.toFixed(4)} m²
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                      {mat.total_pieces} un
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {mat.total_area_m2.toFixed(2)} m²
                    </td>
                  </tr>
                ))}
                {(!load.consolidated_materials || load.consolidated_materials.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-400">
                      Nenhum material consolidado nesta carga.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: IN TRANSIT STOCK SEGREGATION */}
      {activeTab === 'transit' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden space-y-4 p-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              Segregação de Estoque em Trânsito (Ledger / Balances)
            </h3>
            <p className="text-xs text-zinc-500">
              Registros ativos de saldo em trânsito vinculados a esta carga específica
            </p>
          </div>

          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 text-xs font-semibold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2.5">Material</th>
                  <th className="px-4 py-2.5">Pallet ID</th>
                  <th className="px-4 py-2.5 text-right">Saldo em Trânsito</th>
                  <th className="px-4 py-2.5">Data Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {(load.in_transit_balances || []).map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2.5 font-medium">
                      {b.material?.code} — {b.material?.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500">{b.pallet_id}</td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {b.quantity} un
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {new Date(b.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {(!load.in_transit_balances || load.in_transit_balances.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-zinc-400">
                      Nenhum saldo segregado em trânsito atualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ATTACH PALLET MODAL */}
      {isAttachPalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Vincular Pallets à Carga {load.code}
                </h3>
              </div>
              <button
                onClick={() => setIsAttachPalletModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <p className="text-xs text-zinc-500">
                Selecione os pallets prontos na localização <strong>{load.origin_location?.name}</strong> para embarcar na carga:
              </p>

              {eligiblePallets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-400 text-xs">
                  Não há pallets com status PRONTO disponíveis nesta origem.
                </div>
              ) : (
                <div className="space-y-2">
                  {eligiblePallets.map((p) => {
                    const isSelected = selectedPalletIdsToAttach.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleTogglePalletSelection(p.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500'
                            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <div>
                            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {p.code}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {p.items.map((it) => `${it.material.code} (${it.quantity})`).join(', ')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-bold">{p.total_pieces} peças</div>
                          <div className="text-zinc-400 font-mono">{p.total_area_m2.toFixed(2)} m²</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-xs text-zinc-500">
                {selectedPalletIdsToAttach.length} selecionado(s)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAttachPalletModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isAttaching || selectedPalletIdsToAttach.length === 0}
                  onClick={handleAttachPallets}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isAttaching ? 'Vinculando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSPORT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Editar Dados de Transporte — {load.code}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDetails} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    value={editPlate}
                    onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nome do Motorista</label>
                  <input
                    type="text"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Transportadora</label>
                  <input
                    type="text"
                    value={editCarrier}
                    onChange={(e) => setEditCarrier(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Data de Saída Prevista</label>
                  <input
                    type="date"
                    value={editDepartureDate}
                    onChange={(e) => setEditDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Previsão de Chegada</label>
                  <input
                    type="date"
                    value={editArrivalDate}
                    onChange={(e) => setEditArrivalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {isSavingDetails ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL LOAD MODAL */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Cancelar Carga {load.code}
                </h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelLoad} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300">
                {isSent || isInTransit ? (
                  <span>
                    <strong>Atenção:</strong> Esta carga já foi expedida. O cancelamento irá reverter o saldo de estoque de <strong>EM TRÂNSITO</strong> de volta para <strong>RESERVADO</strong> na localização de origem.
                  </span>
                ) : (
                  <span>
                    A carga será cancelada e os pallets vinculados serão liberados para o status PRONTO.
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Motivo do Cancelamento *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Informe detalhadamente a justificativa para cancelamento da carga..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 rounded-lg"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={isCancelling || !cancelReason.trim()}
                  className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT ROMANEIO MODAL */}
      {isPrintModalOpen && (
        <LoadManifestPrintModal
          load={load}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  )
}
