import React, { useState, useEffect } from 'react'
import {
  Building2,
  Package,
  Layers,
  ArrowLeft,
  Plus,
  RefreshCw,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Boxes,
  History,
  CheckCircle2,
  Calendar,
  User,
  Loader2,
  Edit2
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  DemobilizationWithRelations,
  DemobilizationPalletWithDetails,
  StockBalanceWithDetails,
  Material,
} from '../../types'
import { demobilizationService } from '../../services/demobilizationService'
import { StatusBadge } from '../../components/common/StatusBadge'
import { MetricCard } from '../../components/common/MetricCard'
import { PageHeader } from '../../components/common/PageHeader'
import { UpdateTargetModal } from './components/UpdateTargetModal'
import { supabase } from '../../lib/supabase'

interface DemobilizationDetailPageProps {
  demobilizationId?: string
  onBack?: () => void
  onSelectPallet?: (palletId: string) => void
}

interface GroupedStockItem {
  material: Material | undefined
  disponivel: number
  reservado: number
  unitArea: number
}

export const DemobilizationDetailPage: React.FC<DemobilizationDetailPageProps> = ({
  demobilizationId: id,
  onBack,
  onSelectPallet,
}) => {

  const { profile, isAdmin, canManageLocation, canAccessLocation } = useAuth()

  const [demobilization, setDemobilization] = useState<DemobilizationWithRelations | null>(null)
  const [pallets, setPallets] = useState<DemobilizationPalletWithDetails[]>([])
  const [workStockBalances, setWorkStockBalances] = useState<StockBalanceWithDetails[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pallets' | 'stock' | 'history'>('pallets')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreatingPallet, setIsCreatingPallet] = useState(false)
  const [isUpdateTargetOpen, setIsUpdateTargetOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const canOperate =
    isAdmin ||
    (demobilization && canManageLocation(demobilization.work_id)) ||
    profile?.role === 'ENGENHEIRO_OBRA' ||
    profile?.role === 'APONTADOR_OBRA' ||
    profile?.role === 'ALMOXARIFE'

  const loadData = async (showLoading = true) => {
    if (!id) return
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const [demob, palletsList] = await Promise.all([
        demobilizationService.getDemobilizationById(id),
        demobilizationService.getDemobilizationPallets(id),
      ])

      setDemobilization(demob)
      setPallets(palletsList)

      if (demob) {
        // Fetch all stock balances for this work (both DISPONIVEL and RESERVADO)
        const { data: balances } = await supabase
          .from('stock_balances')
          .select(`
            *,
            material:materials(*),
            location:locations(*)
          `)
          .eq('location_id', demob.work_id)
          .order('quantity', { ascending: false })

        setWorkStockBalances((balances || []) as unknown as StockBalanceWithDetails[])

        // Fetch movements related to this demobilization or work
        const { data: mvs } = await supabase
          .from('stock_movements')
          .select(`
            *,
            material:materials(*),
            creator:profiles(name, email),
            pallet:demobilization_pallets(code)
          `)
          .or(`demobilization_id.eq.${id},destination_location_id.eq.${demob.work_id}`)
          .order('created_at', { ascending: false })
          .limit(50)

        setMovements(mvs || [])
      }
    } catch (err) {
      console.error('Erro ao carregar dados da desmobilização:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleCreatePallet = async () => {
    if (!id) return
    setIsCreatingPallet(true)
    setFeedback(null)

    try {
      const res = await demobilizationService.createPallet(id)
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Erro ao criar pallet.' })
        return
      }

      setFeedback({
        type: 'success',
        message: `Pallet ${res.code} criado com sucesso em status EM MONTAGEM.`,
      })

      await loadData(false)

      if (res.pallet_id && onSelectPallet) {
        onSelectPallet(res.pallet_id)
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado.' })
    } finally {
      setIsCreatingPallet(false)
    }
  }

  const handleOpenPallet = (palletId: string) => {
    if (onSelectPallet) {
      onSelectPallet(palletId)
    }
  }

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-zinc-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Carregando painel de desmobilização...</p>
      </div>
    )
  }

  if (!demobilization) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Desmobilização não encontrada</h3>
        <p className="text-xs text-zinc-500">Esta obra pode não estar habilitada ou o registro foi removido.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Voltar para Lista
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para Desmobilizações</span>
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

      {/* Feedback Banner */}
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

      {/* Main Header Card */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20">
                {demobilization.work?.code}
              </span>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {demobilization.work?.name}
              </h1>
              <StatusBadge status={demobilization.status} />
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Destino planejado:{' '}
                  {demobilization.target_location ? (
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      [{demobilization.target_location.type}] {demobilization.target_location.code} — {demobilization.target_location.name}
                    </strong>
                  ) : (
                    <span className="italic">A definir</span>
                  )}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setIsUpdateTargetOpen(true)}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded transition-colors cursor-pointer"
                    title="Editar destino planejado"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Habilitada em:{' '}
                  {new Date(demobilization.enabled_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {demobilization.notes && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 italic bg-zinc-50 dark:bg-[#0a0f18] p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/80">
                "{demobilization.notes}"
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setIsUpdateTargetOpen(true)}
                className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>Alterar Destino</span>
              </button>
            )}

            {canOperate && (
              <button
                onClick={handleCreatePallet}
                disabled={isCreatingPallet}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCreatingPallet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Criar Novo Pallet</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Peças Disponíveis"
          value={demobilization.available_pieces?.toLocaleString('pt-BR') || 0}
          subtitle="Aguardando paletização"
          icon={<Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          title="Peças Reservadas"
          value={demobilization.reserved_pieces?.toLocaleString('pt-BR') || 0}
          subtitle="Bloqueadas em pallets"
          icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />
        <MetricCard
          title="Pallets em Montagem"
          value={demobilization.pallets_in_assembly || 0}
          subtitle="Sendo abastecidos"
          icon={<Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        />
        <MetricCard
          title="Pallets Prontos"
          value={demobilization.pallets_ready || 0}
          subtitle="Aguardando carga"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          title="Área Reservada"
          value={`${demobilization.reserved_area_m2 ? demobilization.reserved_area_m2.toFixed(2) : '0,00'} m²`}
          subtitle="Total m² nos pallets"
          icon={<ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 space-x-6">
        <button
          onClick={() => setActiveTab('pallets')}
          className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'pallets'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pallets de Desmobilização ({pallets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'stock'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Estoque da Obra (Disponível vs Reservado)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Extrato de Movimentações ({movements.length})</span>
        </button>
      </div>

      {/* TAB 1: Pallets de Desmobilização */}
      {activeTab === 'pallets' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] text-zinc-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Código do Pallet</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Itens Distintos</th>
                    <th className="py-3 px-4 text-right">Total Peças</th>
                    <th className="py-3 px-4 text-right">Área Total (m²)</th>
                    <th className="py-3 px-4">Criado por</th>
                    <th className="py-3 px-4">Data Criação</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {pallets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Layers className="w-8 h-8 mx-auto text-zinc-400" />
                          <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhum pallet criado ainda</p>
                          <p className="text-[11px] text-zinc-500">
                            Crie o primeiro pallet para começar a reservar materiais para a desmobilização.
                          </p>
                          {canOperate && (
                            <button
                              onClick={handleCreatePallet}
                              disabled={isCreatingPallet}
                              className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              + Criar Primeiro Pallet
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pallets.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => handleOpenPallet(p.id)}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                          {p.code}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                          {p.items?.length || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {p.total_pieces}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {p.total_area_m2.toFixed(2)} m²
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                          {p.creator?.name || 'Sistema'}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                          {new Date(p.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenPallet(p.id)
                            }}
                            className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-semibold transition-all inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Gerenciar</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Estoque da Obra */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624]">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                Balanço de Materiais na Obra ({demobilization.work?.name})
              </h3>
              <p className="text-xs text-zinc-500">
                Rastreabilidade por bucket: Disponível (livre para paletização) vs Reservado (em pallets de desmobilização)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0a0f18] text-zinc-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Material / Descrição</th>
                    <th className="py-3 px-4 text-right">Área Unitária</th>
                    <th className="py-3 px-4 text-right">Saldo Disponível</th>
                    <th className="py-3 px-4 text-right">Saldo Reservado</th>
                    <th className="py-3 px-4 text-right">Total Físico na Obra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {workStockBalances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Nenhum saldo registrado nesta obra.
                      </td>
                    </tr>
                  ) : (
                    // Group balances by material_id
                    Array.from(
                      workStockBalances
                        .reduce<Map<string, GroupedStockItem>>((acc, curr) => {
                          const matId = curr.material_id
                          if (!acc.has(matId)) {
                            acc.set(matId, {
                              material: curr.material as Material | undefined,
                              disponivel: 0,
                              reservado: 0,
                              unitArea: Number(curr.material?.unit_area_m2 || 0),
                            })
                          }
                          const entry = acc.get(matId)!
                          if (curr.bucket === 'DISPONIVEL') entry.disponivel += Number(curr.quantity || 0)
                          if (curr.bucket === 'RESERVADO') entry.reservado += Number(curr.quantity || 0)
                          return acc
                        }, new Map<string, GroupedStockItem>())
                        .values()
                    ).map((item: GroupedStockItem, idx) => {
                      const totalFisico = item.disponivel + item.reservado
                      return (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {item.material?.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                            {item.material?.name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-500">
                            {item.unitArea.toFixed(2)} m²
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.disponivel} pçs
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {item.reservado} pçs
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {totalFisico} pçs ({((totalFisico * item.unitArea)).toFixed(2)} m²)
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Histórico de Movimentações */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] text-zinc-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Tipo de Movimento</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Quantidade</th>
                    <th className="py-3 px-4">Transição de Bucket</th>
                    <th className="py-3 px-4">Pallet</th>
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Chave de Idempotência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        Nenhuma movimentação registrada para esta obra.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 text-zinc-500 text-[11px]">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              m.movement_type === 'RESERVA_PALLET'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                : m.movement_type === 'LIBERACAO_PALLET'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {m.material?.code}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate max-w-[140px]">
                            {m.material?.name}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {m.quantity}
                        </td>
                        <td className="py-3 px-4 text-[11px]">
                          {m.source_bucket ? (
                            <div className="flex items-center space-x-1 font-mono">
                              <span className="text-zinc-500">{m.source_bucket}</span>
                              <span className="text-zinc-400">→</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{m.destination_bucket}</span>
                            </div>
                          ) : (
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">{m.destination_bucket}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400 text-xs">
                          {m.pallet?.code || (m.demobilization_pallet_id ? `Pallet` : '—')}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-xs">
                          {m.creator?.name || 'Sistema'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-zinc-400 truncate max-w-[120px]" title={m.idempotency_key || ''}>
                          {m.idempotency_key ? m.idempotency_key.slice(0, 18) + '...' : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Target */}
      <UpdateTargetModal
        isOpen={isUpdateTargetOpen}
        demobilizationId={demobilization.id}
        currentWorkId={demobilization.work_id}
        currentTargetId={demobilization.target_location_id}
        currentNotes={demobilization.notes}
        onClose={() => setIsUpdateTargetOpen(false)}
        onSuccess={() => {
          loadData(false)
        }}
      />
    </div>
  )
}
