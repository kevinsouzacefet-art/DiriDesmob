import React, { useState, useEffect } from 'react'
import {
  Layers,
  ArrowLeft,
  Plus,
  Minus,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Package,
  Trash2,
  RotateCcw,
  Boxes,
  Loader2,
  Building2,
  Calendar,
  User,
  Info
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  DemobilizationPalletWithDetails,
  DemobilizationPalletItemWithMaterial,
} from '../../types'
import { demobilizationService } from '../../services/demobilizationService'
import { StatusBadge } from '../../components/common/StatusBadge'
import { MetricCard } from '../../components/common/MetricCard'
import { PageHeader } from '../../components/common/PageHeader'
import { AddMaterialToPalletModal } from './components/AddMaterialToPalletModal'
import { RemoveMaterialFromPalletModal } from './components/RemoveMaterialFromPalletModal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'

interface PalletDetailPageProps {
  palletId?: string
  onBack?: () => void
}

export const PalletDetailPage: React.FC<PalletDetailPageProps> = ({
  palletId,
  onBack,
}) => {

  const { profile, isAdmin, canManageLocation } = useAuth()

  const [pallet, setPallet] = useState<DemobilizationPalletWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedRemoveItem, setSelectedRemoveItem] = useState<DemobilizationPalletItemWithMaterial | null>(null)
  const [isConfirmReleaseOpen, setIsConfirmReleaseOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const canOperate =
    isAdmin ||
    (pallet && canManageLocation(pallet.origin_location_id)) ||
    profile?.role === 'ENGENHEIRO_OBRA' ||
    profile?.role === 'APONTADOR_OBRA' ||
    profile?.role === 'ALMOXARIFE'

  const loadData = async (showLoading = true) => {
    if (!palletId) return
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const data = await demobilizationService.getPalletById(palletId)
      setPallet(data)
    } catch (err) {
      console.error('Erro ao carregar pallet:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [palletId])

  // Mark Ready
  const handleMarkReady = async () => {
    if (!palletId || !pallet) return
    if (pallet.items.length === 0) {
      setFeedback({ type: 'error', message: 'Não é possível marcar como pronto um pallet sem itens.' })
      return
    }

    setActionLoading('ready')
    setFeedback(null)

    try {
      const res = await demobilizationService.markPalletReady(palletId)
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Erro ao marcar pallet como pronto.' })
        return
      }

      setFeedback({
        type: 'success',
        message: `Pallet ${pallet.code} finalizado com status PRONTO para futura carga.`,
      })
      await loadData(false)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado.' })
    } finally {
      setActionLoading(null)
    }
  }

  // Reopen Pallet
  const handleReopen = async () => {
    if (!palletId || !pallet) return

    setActionLoading('reopen')
    setFeedback(null)

    try {
      const res = await demobilizationService.reopenPallet(palletId)
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Erro ao reabrir pallet.' })
        return
      }

      setFeedback({
        type: 'success',
        message: `Pallet ${pallet.code} reaberto em status EM MONTAGEM.`,
      })
      await loadData(false)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado.' })
    } finally {
      setActionLoading(null)
    }
  }

  // Release Pallet Stock (Desmontar)
  const handleReleaseStock = async () => {
    if (!palletId || !pallet) return

    setActionLoading('release')
    setFeedback(null)

    try {
      const res = await demobilizationService.releasePalletStock(palletId)
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Erro ao desmontar pallet.' })
        return
      }

      setFeedback({
        type: 'success',
        message: `Pallet ${pallet.code} desmontado com sucesso. Todos os itens retornaram para DISPONÍVEL na obra.`,
      })
      setIsConfirmReleaseOpen(false)
      await loadData(false)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado ao desmontar pallet.' })
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-zinc-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Carregando detalhes do pallet...</p>
      </div>
    )
  }

  if (!pallet) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Pallet não encontrado</h3>
        <p className="text-xs text-zinc-500">O pallet pode ter sido excluído ou você não possui permissão para visualizá-lo.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Voltar para Desmobilização
          </button>
        )}
      </div>
    )
  }

  const isEditable = pallet.status === 'EM_MONTAGEM' && canOperate
  const isReady = pallet.status === 'PRONTO'
  const isDismantled = pallet.status === 'DESMONTADO' || pallet.status === 'CANCELADO'

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para Obra: {pallet.origin_location?.name}</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(false)}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline font-medium hover:opacity-80 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Header Pallet Card */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-bold text-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {pallet.code}
                  </h1>
                  <StatusBadge status={pallet.status} />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Pallet de Desmobilização — Obra:{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    {pallet.origin_location?.code} — {pallet.origin_location?.name}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-3 text-xs text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Criado em: {new Date(pallet.created_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(pallet.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span>Responsável: {pallet.creator?.name || 'Sistema'}</span>
              </div>
              {pallet.destination_location && (
                <div className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    Destino: [{pallet.destination_location.type}] {pallet.destination_location.code}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons for Pallet */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isEditable && (
              <>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Material</span>
                </button>

                <button
                  onClick={handleMarkReady}
                  disabled={actionLoading === 'ready' || pallet.items.length === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading === 'ready' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Marcar como Pronto</span>
                </button>

                <button
                  onClick={() => setIsConfirmReleaseOpen(true)}
                  disabled={actionLoading === 'release'}
                  className="px-3 py-2 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Desmontar pallet e liberar todo o estoque"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desmontar</span>
                </button>
              </>
            )}

            {isReady && canOperate && (
              <>
                <button
                  onClick={handleReopen}
                  disabled={actionLoading === 'reopen'}
                  className="px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  {actionLoading === 'reopen' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Reabrir Pallet</span>
                </button>

                <button
                  onClick={() => setIsConfirmReleaseOpen(true)}
                  disabled={actionLoading === 'release'}
                  className="px-3 py-2 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desmontar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dismantled Banner */}
      {isDismantled && (
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-2">
          <Info className="w-4 h-4 text-zinc-500 shrink-0" />
          <span>
            Este pallet foi <strong>{pallet.status === 'DESMONTADO' ? 'desmontado' : 'cancelado'}</strong>. Os materiais que estavam nele foram devolvidos integralmente para o saldo disponível da obra.
          </span>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Itens Distintos"
          value={pallet.items.length}
          subtitle="Tipos de fôrmas no pallet"
          icon={<Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        />
        <MetricCard
          title="Total de Peças no Pallet"
          value={pallet.total_pieces}
          subtitle="Peças reservadas neste pallet"
          icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />
        <MetricCard
          title="Área Total do Pallet"
          value={`${pallet.total_area_m2.toFixed(2)} m²`}
          subtitle="Metragem quadrada total"
          icon={<ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
      </div>

      {/* Pallet Items Table */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Materiais Alocados no Pallet
            </h3>
            <p className="text-xs text-zinc-500">
              Cada inclusão/retirada ajusta atomicamente o saldo entre DISPONÍVEL e RESERVADO
            </p>
          </div>

          {isEditable && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Material</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0a0f18] text-zinc-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Código Material</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4 text-right">Área Unitária</th>
                <th className="py-3 px-4 text-right">Disponível na Obra</th>
                <th className="py-3 px-4 text-right">Qtd. no Pallet</th>
                <th className="py-3 px-4 text-right">Área no Pallet (m²)</th>
                {isEditable && <th className="py-3 px-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {pallet.items.length === 0 ? (
                <tr>
                  <td colSpan={isEditable ? 7 : 6} className="py-12 text-center text-zinc-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Package className="w-8 h-8 mx-auto text-zinc-400" />
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhum material neste pallet</p>
                      <p className="text-[11px] text-zinc-500">
                        {isEditable
                          ? 'Clique no botão acima para adicionar materiais do estoque disponível da obra.'
                          : 'Este pallet está vazio.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pallet.items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {item.material?.code}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                      {item.material?.name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-zinc-500">
                      {Number(item.material?.unit_area_m2 || 0).toFixed(2)} m²
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {item.available_at_work || 0} pçs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {item.quantity} pçs
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.total_area_m2?.toFixed(2)} m²
                    </td>
                    {isEditable && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRemoveItem(item)}
                            className="px-2.5 py-1 text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Remover peças deste item"
                          >
                            <Minus className="w-3 h-3" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {pallet.items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0e1624] font-bold text-xs">
                  <td colSpan={4} className="py-3 px-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Total do Pallet
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {pallet.total_pieces} pçs
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    {pallet.total_area_m2.toFixed(2)} m²
                  </td>
                  {isEditable && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal: Add Material */}
      <AddMaterialToPalletModal
        isOpen={isAddModalOpen}
        palletId={pallet.id}
        palletCode={pallet.code}
        originLocationId={pallet.origin_location_id}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadData(false)
        }}
      />

      {/* Modal: Remove Material */}
      <RemoveMaterialFromPalletModal
        isOpen={!!selectedRemoveItem}
        palletId={pallet.id}
        palletCode={pallet.code}
        item={selectedRemoveItem}
        onClose={() => setSelectedRemoveItem(null)}
        onSuccess={() => {
          loadData(false)
        }}
      />

      {/* Dialog: Confirm Release Stock (Desmontar) */}
      <ConfirmDialog
        isOpen={isConfirmReleaseOpen}
        title={`Desmontar Pallet ${pallet.code}?`}
        message={`Esta ação devolverá todas as ${pallet.total_pieces} peças (${pallet.total_area_m2.toFixed(2)} m²) do pallet para o saldo DISPONÍVEL da obra. O pallet passará para o status DESMONTADO.`}
        confirmText="Sim, Desmontar Pallet"
        cancelText="Cancelar"
        type="danger"
        isLoading={actionLoading === 'release'}
        onConfirm={handleReleaseStock}
        onCancel={() => setIsConfirmReleaseOpen(false)}
      />
    </div>
  )
}
