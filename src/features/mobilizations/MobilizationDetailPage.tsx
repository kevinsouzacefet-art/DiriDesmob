import React, { useState, useEffect } from 'react'
import {
  ArrowLeft,
  PackageCheck,
  Building2,
  Truck,
  Calendar,
  Layers,
  Boxes,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  FileText,
  User,
} from 'lucide-react'
import { MobilizationWithRelations } from '../../types'
import { mobilizationService } from '../../services/mobilizationService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface MobilizationDetailPageProps {
  mobilizationId: string
  onBack: () => void
  onNavigateToStock: () => void
}

export const MobilizationDetailPage: React.FC<MobilizationDetailPageProps> = ({
  mobilizationId,
  onBack,
  onNavigateToStock,
}) => {
  const [mobilization, setMobilization] = useState<MobilizationWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedPallets, setExpandedPallets] = useState<Record<string, boolean>>({})
  const [searchItemQuery, setSearchItemQuery] = useState('')

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true)
      try {
        const data = await mobilizationService.getMobilizationById(mobilizationId)
        setMobilization(data)

        // Expand all pallets by default
        if (data?.pallets) {
          const initialMap: Record<string, boolean> = {}
          data.pallets.forEach((p) => {
            initialMap[p.id] = true
          })
          setExpandedPallets(initialMap)
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes da mobilização:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (mobilizationId) {
      fetchDetail()
    }
  }, [mobilizationId])

  const togglePallet = (palletId: string) => {
    setExpandedPallets((prev) => ({
      ...prev,
      [palletId]: !prev[palletId],
    }))
  }

  const toggleAllPallets = (expand: boolean) => {
    if (!mobilization?.pallets) return
    const newMap: Record<string, boolean> = {}
    mobilization.pallets.forEach((p) => {
      newMap[p.id] = expand
    })
    setExpandedPallets(newMap)
  }

  if (isLoading) {
    return <LoadingState message="Carregando detalhes da mobilização e pallets..." />
  }

  if (!mobilization) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Mobilizações
        </button>
        <div className="p-8 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <EmptyState
            title="Mobilização não encontrada"
            description="Não foi possível localizar os registros desta mobilização no banco de dados."
            actionLabel="Voltar à Listagem"
            onAction={onBack}
          />
        </div>
      </div>
    )
  }

  const formattedDate = new Date(mobilization.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Filter pallets or items by search query
  const filteredPallets = (mobilization.pallets || []).filter((p) => {
    if (!searchItemQuery.trim()) return true
    const q = searchItemQuery.toLowerCase().trim()
    const palletMatch = p.pallet_number.toLowerCase().includes(q)
    const itemMatch = p.items.some(
      (it) =>
        it.material?.code.toLowerCase().includes(q) ||
        it.material?.name.toLowerCase().includes(q)
    )
    return palletMatch || itemMatch
  })

  return (
    <div className="space-y-6" id="mobilization-detail-view">
      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {mobilization.code}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluída
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Mobilização registrada em {formattedDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToStock}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
          >
            <Boxes className="w-4 h-4" />
            Ver Estoque Resultante
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="p-5 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400 uppercase">Obra Receptora</span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {mobilization.destination_work?.code}
              </p>
              <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                {mobilization.destination_work?.name}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400 uppercase">Origem da Remessa</span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {mobilization.origin_location?.code || 'Múltiplas origens'}
              </p>
              <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                {mobilization.origin_location?.name || 'Origens diversas por pallet'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400 uppercase">Total de Peças / Área</span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {(mobilization.total_pieces || 0).toLocaleString('pt-BR')} peças
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                {Number(mobilization.total_area_m2 || 0).toFixed(2)} m² de contato
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400 uppercase">Origem dos Dados</span>
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-0.5 truncate max-w-[200px]">
                {mobilization.notes || 'Importação via Excel'}
              </p>
              {mobilization.creator && (
                <p className="text-[11px] text-zinc-400">
                  Por: {mobilization.creator.full_name || mobilization.creator.email}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pallets Section Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Pallets de Mobilização ({mobilization.pallets?.length || 0})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar pallet ou material..."
              value={searchItemQuery}
              onChange={(e) => setSearchItemQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <button
            type="button"
            onClick={() => toggleAllPallets(true)}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 transition shadow-2xs"
          >
            Expandir Todos
          </button>
          <button
            type="button"
            onClick={() => toggleAllPallets(false)}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 transition shadow-2xs"
          >
            Recolher
          </button>
        </div>
      </div>

      {/* Pallet Cards Accordion */}
      {filteredPallets.length === 0 ? (
        <div className="p-8 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
          <p className="text-sm text-zinc-500">Nenhum pallet corresponde à busca realizada.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPallets.map((pallet) => {
            const isExpanded = !!expandedPallets[pallet.id]

            return (
              <div
                key={pallet.id}
                className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs transition"
              >
                {/* Pallet Accordion Bar */}
                <button
                  type="button"
                  onClick={() => togglePallet(pallet.id)}
                  className="w-full flex items-center justify-between p-4 bg-zinc-50/70 dark:bg-zinc-850/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {pallet.pallet_number}
                      </span>
                      <span className="text-xs text-zinc-400 ml-2 font-mono">
                        (UUID: {pallet.id.slice(0, 8)}...)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {pallet.totalPieces || 0} peças
                      </span>
                      <span className="text-zinc-400 ml-2 font-mono">
                        ({Number(pallet.totalAreaM2 || 0).toFixed(2)} m²)
                      </span>
                    </div>

                    <div className="text-zinc-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Items Breakdown Table */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-500 uppercase text-[11px] font-semibold tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Código Material</th>
                          <th className="py-2.5 px-4">Descrição do Material</th>
                          <th className="py-2.5 px-4 text-center">Dimensões (mm)</th>
                          <th className="py-2.5 px-4 text-right">Quantidade</th>
                          <th className="py-2.5 px-4 text-right">Área Unitária</th>
                          <th className="py-2.5 px-4 text-right">Área Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                        {pallet.items.map((item) => {
                          const unitArea = Number(item.material?.unit_area_m2 || 0)
                          const totalItemArea = Number((unitArea * item.quantity).toFixed(4))

                          return (
                            <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                              <td className="py-2.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                                {item.material?.code || '---'}
                              </td>
                              <td className="py-2.5 px-4 text-zinc-800 dark:text-zinc-200">
                                {item.material?.name || '---'}
                              </td>
                              <td className="py-2.5 px-4 text-center font-mono text-zinc-500">
                                {item.material?.width_mm && item.material?.height_mm
                                  ? `${item.material.width_mm} × ${item.material.height_mm}`
                                  : '---'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                {item.quantity.toLocaleString('pt-BR')}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-zinc-500">
                                {unitArea.toFixed(2)} m²
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-medium text-zinc-800 dark:text-zinc-200">
                                {totalItemArea.toFixed(2)} m²
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
