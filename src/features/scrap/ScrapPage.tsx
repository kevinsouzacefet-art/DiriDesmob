import React, { useState, useEffect } from 'react'
import {
  Trash2,
  Search,
  Filter,
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
  Plus,
  ShieldAlert,
  Building2,
  Truck,
  RotateCcw,
  AlertOctagon,
  FileCheck,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  Location,
  Material,
  StockBucket,
  ScrapMovementRequestWithDetails,
  ScrapMovementRequestStatus,
} from '../../types'
import {
  scrapService,
  SupplierStockSummary,
  ClassifyMaterialPayload,
  RequestScrapMovementPayload,
} from '../../services/scrapService'
import { locationService } from '../../services/locationService'
import { materialService } from '../../services/materialService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

export const ScrapPage: React.FC = () => {
  const { profile, isAdmin, isAnalyst, isSupplier } = useAuth()
  const canAdministrate = isAdmin || isAnalyst

  const [activeTab, setActiveTab] = useState<'CLASSIFICATION' | 'MOVEMENTS'>('CLASSIFICATION')
  const [suppliers, setSuppliers] = useState<Location[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [supplierStocks, setSupplierStocks] = useState<SupplierStockSummary[]>([])
  const [movementRequests, setMovementRequests] = useState<ScrapMovementRequestWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [isRequestMovementOpen, setIsRequestMovementOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [selectedRequestForReject, setSelectedRequestForReject] = useState<ScrapMovementRequestWithDetails | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Form states - Classification
  const [classifyMaterialId, setClassifyMaterialId] = useState<string>('')
  const [classifyMaxQty, setClassifyMaxQty] = useState<number>(0)
  const [classifyQty, setClassifyQty] = useState<number>(1)
  const [classifyDestination, setClassifyDestination] = useState<'REAPROVEITAVEL' | 'SUCATA'>('REAPROVEITAVEL')
  const [classifyNotes, setClassifyNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states - Request Movement
  const [reqOriginId, setReqOriginId] = useState<string>('')
  const [reqDestinationId, setReqDestinationId] = useState<string>('')
  const [reqMaterialId, setReqMaterialId] = useState<string>('')
  const [reqQuantity, setReqQuantity] = useState<number>(1)
  const [reqNotes, setReqNotes] = useState<string>('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [locs, mats, reqs] = await Promise.all([
        locationService.getLocations(),
        materialService.listMaterials(),
        scrapService.getScrapMovementRequests(),
      ])

      setLocations(locs)
      setMaterials(mats)
      setMovementRequests(reqs)

      const supList = locs.filter((l) => l.type === 'FORNECEDOR')
      setSuppliers(supList)

      // Set default selected supplier
      let defaultSupId = selectedSupplierId
      if (!defaultSupId && supList.length > 0) {
        defaultSupId = supList[0].id
        setSelectedSupplierId(defaultSupId)
      }

      if (defaultSupId) {
        const stocks = await scrapService.getSupplierStocks(defaultSupId)
        setSupplierStocks(stocks)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de sucata:', err)
      setFeedbackMessage({ type: 'error', text: err.message || 'Falha ao carregar dados.' })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSupplierChange = async (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    try {
      const stocks = await scrapService.getSupplierStocks(supplierId)
      setSupplierStocks(stocks)
    } catch (err: any) {
      console.error('Erro ao buscar estoque do fornecedor:', err)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    if (selectedSupplierId) {
      const stocks = await scrapService.getSupplierStocks(selectedSupplierId)
      setSupplierStocks(stocks)
    }
  }

  // Open classify modal
  const handleOpenClassify = (item: SupplierStockSummary) => {
    setClassifyMaterialId(item.material_id)
    setClassifyMaxQty(item.aguardando_classificacao)
    setClassifyQty(item.aguardando_classificacao > 0 ? item.aguardando_classificacao : 1)
    setClassifyDestination('REAPROVEITAVEL')
    setClassifyNotes('')
    setIsClassifyModalOpen(true)
  }

  // Submit Classification
  const handleClassifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplierId || !classifyMaterialId || classifyQty <= 0) {
      setFeedbackMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: ClassifyMaterialPayload = {
        supplierLocationId: selectedSupplierId,
        materialId: classifyMaterialId,
        quantity: classifyQty,
        destinationClassification: classifyDestination,
        notes: classifyNotes.trim() || 'Classificação física realizada pelo fornecedor.',
      }

      const res = await scrapService.classifySupplierMaterial(payload)
      setFeedbackMessage({ type: 'success', text: res.message || 'Material classificado com sucesso.' })
      setIsClassifyModalOpen(false)
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao classificar material.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Request Scrap Movement
  const handleRequestMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqOriginId || !reqDestinationId || !reqMaterialId || reqQuantity <= 0) {
      setFeedbackMessage({ type: 'error', text: 'Preencha os campos obrigatórios da solicitação.' })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: RequestScrapMovementPayload = {
        originLocationId: reqOriginId,
        destinationLocationId: reqDestinationId,
        materialId: reqMaterialId,
        quantity: reqQuantity,
        notes: reqNotes.trim() || null,
      }

      const res = await scrapService.requestScrapMovement(payload)
      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Solicitação de movimentação de sucata enviada para aprovação.',
      })
      setIsRequestMovementOpen(false)
      resetRequestForm()
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao solicitar movimentação.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetRequestForm = () => {
    setReqOriginId(selectedSupplierId || '')
    setReqDestinationId('')
    setReqMaterialId('')
    setReqQuantity(1)
    setReqNotes('')
  }

  // Approve Movement
  const handleApproveMovement = async (requestId: string) => {
    try {
      setIsSubmitting(true)
      const res = await scrapService.approveScrapMovement(requestId)
      setFeedbackMessage({ type: 'success', text: res.message || 'Movimentação de sucata aprovada e executada.' })
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao aprovar movimentação.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reject Movement
  const handleOpenRejectModal = (req: ScrapMovementRequestWithDetails) => {
    setSelectedRequestForReject(req)
    setRejectReason('')
    setIsRejectModalOpen(true)
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequestForReject || !rejectReason.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Informe a justificativa da rejeição.' })
      return
    }

    try {
      setIsSubmitting(true)
      const res = await scrapService.rejectScrapMovement(selectedRequestForReject.id, rejectReason.trim())
      setFeedbackMessage({ type: 'success', text: res.message || 'Solicitação rejeitada com sucesso.' })
      setIsRejectModalOpen(false)
      await handleRefresh()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao rejeitar solicitação.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Summary counts for selected supplier
  const totalAguardando = supplierStocks.reduce((acc, s) => acc + s.aguardando_classificacao, 0)
  const totalDisponivel = supplierStocks.reduce((acc, s) => acc + s.disponivel, 0)
  const totalSucata = supplierStocks.reduce((acc, s) => acc + s.sucata, 0)
  const totalGeral = supplierStocks.reduce((acc, s) => acc + s.total_fisico, 0)

  // Filtered materials
  const filteredStocks = supplierStocks.filter((s) => {
    const matchesSearch =
      s.material_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.material_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const getRequestStatusBadge = (status: ScrapMovementRequestStatus) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Aguardando Aprovação
          </span>
        )
      case 'APROVADA':
      case 'EXECUTADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Aprovada & Executada
          </span>
        )
      case 'REJEITADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <X className="w-3 h-3" /> Rejeitada
          </span>
        )
      default:
        return <span className="text-xs">{status}</span>
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando classificação do fornecedor e controle de sucata..." />
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
            <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-500" />
            Classificação do Fornecedor & Sucatas
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Classificação física de material recebido (Reaproveitável vs Sucata) e aprovação de destinação de sucata
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

          {activeTab === 'MOVEMENTS' && (
            <button
              onClick={() => {
                resetRequestForm()
                setIsRequestMovementOpen(true)
              }}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white flex items-center gap-2 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Solicitar Movimentação de Sucata
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('CLASSIFICATION')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'CLASSIFICATION'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Estoque & Classificação no Fornecedor
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'MOVEMENTS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Truck className="w-4 h-4" />
          Movimentação de Sucata ({movementRequests.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLASSIFICAÇÃO NO FORNECEDOR */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSIFICATION' && (
        <div className="space-y-6">
          {/* Supplier Selector */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Fornecedor Selecionado:
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-semibold"
              >
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-zinc-500 italic">
              Regra Oficial: O fornecedor classifica diretamente seu estoque recebido.
            </div>
          </div>

          {/* Buckets Metric Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs bg-amber-50/20 dark:bg-amber-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Aguardando Classificação
              </span>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {totalAguardando} <span className="text-xs font-normal text-zinc-500">peças</span>
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xs bg-emerald-50/20 dark:bg-emerald-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Reaproveitável / Disponível
              </span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {totalDisponivel} <span className="text-xs font-normal text-zinc-500">peças</span>
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-rose-200/80 dark:border-rose-900/40 p-4 shadow-xs bg-rose-50/20 dark:bg-rose-950/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Sucata Retida
              </span>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                {totalSucata} <span className="text-xs font-normal text-zinc-500">peças</span>
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Total Físico no Local
              </span>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {totalGeral} <span className="text-xs font-normal text-zinc-500">peças</span>
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código ou descrição do material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Stock Table */}
          {filteredStocks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum saldo físico neste fornecedor"
              description="Nenhum material encontrado no estoque do fornecedor selecionado."
            />
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Código & Descrição</th>
                      <th className="py-3 px-4 text-center">Aguardando Classificação</th>
                      <th className="py-3 px-4 text-center">Disponível / Reaproveitável</th>
                      <th className="py-3 px-4 text-center">Sucata</th>
                      <th className="py-3 px-4 text-center">Total Físico</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    {filteredStocks.map((item) => (
                      <tr
                        key={item.material_id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                              {item.material_code}
                            </span>
                            <span className="text-xs text-zinc-500">{item.material_name}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              item.aguardando_classificacao > 0
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {item.aguardando_classificacao} un
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              item.disponivel > 0
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {item.disponivel} un
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              item.sucata > 0
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {item.sucata} un
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                          {item.total_fisico} un
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenClassify(item)}
                            disabled={item.aguardando_classificacao <= 0}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Classificar Peças
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MOVIMENTAÇÃO DE SUCATA */}
      {/* ========================================================================= */}
      {activeTab === 'MOVEMENTS' && (
        <div className="space-y-6">
          {/* Rules Banner */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
            <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Controle Rigoroso de Sucata</span>
              <p className="mt-0.5">
                Peças classificadas como Sucata permanecem retidas fisicamente. Qualquer saída, devolução ao galpão ou
                descarte exige aprovação administrativa prévia do gestor para evitar fraudes ou perdas não auditadas.
              </p>
            </div>
          </div>

          {/* Requests Table */}
          {movementRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma solicitação de movimentação de sucata"
              description="Clique em 'Solicitar Movimentação de Sucata' para registrar uma nova solicitação."
            />
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Material / Peça</th>
                      <th className="py-3 px-4">Origem → Destino</th>
                      <th className="py-3 px-4 text-center">Quantidade</th>
                      <th className="py-3 px-4">Solicitante & Motivo</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ação / Decisão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    {movementRequests.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        {/* Material */}
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                              {req.material?.code}
                            </span>
                            <span className="text-xs text-zinc-500">{req.material?.name}</span>
                          </div>
                        </td>

                        {/* Origem -> Destino */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-zinc-700 dark:text-zinc-300">
                            <span className="font-medium">{req.origin_location?.name}</span>
                            <span className="text-zinc-400 mx-1">→</span>
                            <span className="font-medium">{req.destination_location?.name}</span>
                          </div>
                        </td>

                        {/* Quantidade */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-xs">
                            {req.quantity} un
                          </span>
                        </td>

                        {/* Solicitante & Motivo */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                              {req.requester?.full_name || req.requester?.email || 'Solicitante'}
                            </span>
                            <span className="text-zinc-500 line-clamp-1">{req.notes || 'Sem observações'}</span>
                            {req.rejection_reason && (
                              <span className="text-rose-600 dark:text-rose-400 block font-medium mt-0.5">
                                Rejeição: {req.rejection_reason}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {getRequestStatusBadge(req.status)}
                        </td>

                        {/* Ação / Decisão */}
                        <td className="py-3.5 px-4 text-right">
                          {canAdministrate && req.status === 'PENDENTE' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveMovement(req.id)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(req)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-colors"
                              >
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CLASSIFICAR PEÇAS NO FORNECEDOR */}
      {/* ========================================================================= */}
      {isClassifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" />
                Classificar Peças Recebidas
              </h2>
              <button onClick={() => setIsClassifyModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleClassifySubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Destino da Classificação:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClassifyDestination('REAPROVEITAVEL')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      classifyDestination === 'REAPROVEITAVEL'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    Reaproveitável (Disponível)
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassifyDestination('SUCATA')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      classifyDestination === 'SUCATA'
                        ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Trash2 className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                    Condenar como Sucata
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Quantidade a Classificar:
                  </label>
                  <span className="text-zinc-400">
                    Disponível p/ classificar: {classifyMaxQty} un
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={classifyMaxQty}
                  value={classifyQty}
                  onChange={(e) => setClassifyQty(parseInt(e.target.value) || 1)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Observação do Fornecedor:
                </label>
                <textarea
                  value={classifyNotes}
                  onChange={(e) => setClassifyNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Peças limpas e verificadas prontas para nova locação..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsClassifyModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || classifyQty <= 0 || classifyQty > classifyMaxQty}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Gravando...' : 'Confirmar Classificação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SOLICITAR MOVIMENTAÇÃO DE SUCATA */}
      {/* ========================================================================= */}
      {isRequestMovementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Solicitar Movimentação de Sucata
              </h2>
              <button onClick={() => setIsRequestMovementOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestMovementSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Origem (Local com Sucata):
                </label>
                <select
                  value={reqOriginId}
                  onChange={(e) => setReqOriginId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecione a origem...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Destino (Galpão / Descarte):
                </label>
                <select
                  value={reqDestinationId}
                  onChange={(e) => setReqDestinationId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecione o destino...</option>
                  {locations
                    .filter((l) => l.id !== reqOriginId)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Material:
                </label>
                <select
                  value={reqMaterialId}
                  onChange={(e) => setReqMaterialId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Selecione o material...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Quantidade a Movimentar:
                </label>
                <input
                  type="number"
                  min="1"
                  value={reqQuantity}
                  onChange={(e) => setReqQuantity(parseInt(e.target.value) || 1)}
                  required
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Justificativa / Motivo:
                </label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Envio de sucata para pesagem e venda autorizada..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRequestMovementOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJEITAR MOVIMENTAÇÃO DE SUCATA */}
      {/* ========================================================================= */}
      {isRejectModalOpen && selectedRequestForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 text-rose-600 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                Rejeitar Solicitação de Sucata
              </h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <p className="text-zinc-600 dark:text-zinc-400">
                Você está rejeitando a movimentação de <strong>{selectedRequestForReject.quantity} un</strong> de{' '}
                <strong>{selectedRequestForReject.material?.code}</strong>.
              </p>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Motivo da Rejeição (Obrigatório):
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Explique o motivo do indeferimento da movimentação..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejeitando...' : 'Confirmar Rejeição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
