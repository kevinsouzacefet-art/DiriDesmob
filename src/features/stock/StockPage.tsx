import React, { useState, useEffect } from 'react'
import {
  Boxes,
  Building2,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  History,
  RotateCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { StockBalanceWithDetails, StockMovement, Location } from '../../types'
import { stockService } from '../../services/stockService'
import { locationService } from '../../services/locationService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface StockPageProps {
  onNavigateToMobilizations?: () => void
}

export const StockPage: React.FC<StockPageProps> = ({ onNavigateToMobilizations }) => {
  const [balances, setBalances] = useState<StockBalanceWithDetails[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [isLoadingMovements, setIsLoadingMovements] = useState(false)

  const loadData = async () => {
    try {
      const [bal, locs] = await Promise.all([
        stockService.getStockBalances(selectedLocationId, searchQuery),
        locationService.listLocations(),
      ])
      setBalances(bal)
      setLocations(locs)
    } catch (err) {
      console.error('Erro ao carregar saldos de estoque:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedLocationId, searchQuery])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  const handleOpenLedger = async () => {
    setShowLedgerModal(true)
    setIsLoadingMovements(true)
    try {
      const movs = await stockService.getStockMovements(selectedLocationId, 50)
      setMovements(movs)
    } catch (err) {
      console.error('Erro ao buscar extrato do ledger:', err)
    } finally {
      setIsLoadingMovements(false)
    }
  }

  // Summary Metrics
  const totalAvailablePieces = balances
    .filter((b) => b.bucket === 'DISPONIVEL')
    .reduce((sum, b) => sum + Number(b.quantity || 0), 0)

  const totalReservedPieces = balances
    .filter((b) => b.bucket === 'RESERVADO')
    .reduce((sum, b) => sum + Number(b.quantity || 0), 0)

  const totalAllPieces = balances.reduce((sum, b) => sum + Number(b.quantity || 0), 0)

  const totalAvailableAreaM2 = balances
    .filter((b) => b.bucket === 'DISPONIVEL')
    .reduce((sum, b) => {
      const unitArea = Number(b.material?.unit_area_m2 || 0)
      return sum + Number(b.quantity || 0) * unitArea
    }, 0)

  // Group balances by (location_id, material_id) to show available vs reserved neatly
  interface AggregatedBalance {
    id: string
    location: Location
    material: any
    availableQty: number
    reservedQty: number
    totalQty: number
    unitAreaM2: number
    totalAvailableAreaM2: number
  }

  const aggregatedMap = new Map<string, AggregatedBalance>()

  balances.forEach((b) => {
    const key = `${b.location_id}_${b.material_id}`
    const existing = aggregatedMap.get(key)
    const unitArea = Number(b.material?.unit_area_m2 || 0)
    const qty = Number(b.quantity || 0)

    if (existing) {
      if (b.bucket === 'DISPONIVEL') {
        existing.availableQty += qty
      } else if (b.bucket === 'RESERVADO') {
        existing.reservedQty += qty
      }
      existing.totalQty += qty
      existing.totalAvailableAreaM2 = Number((existing.availableQty * unitArea).toFixed(4))
    } else {
      aggregatedMap.set(key, {
        id: b.id,
        location: b.location,
        material: b.material,
        availableQty: b.bucket === 'DISPONIVEL' ? qty : 0,
        reservedQty: b.bucket === 'RESERVADO' ? qty : 0,
        totalQty: qty,
        unitAreaM2: unitArea,
        totalAvailableAreaM2: Number(( (b.bucket === 'DISPONIVEL' ? qty : 0) * unitArea ).toFixed(4)),
      })
    }
  })

  const aggregatedList = Array.from(aggregatedMap.values())

  if (isLoading && balances.length === 0) {
    return <LoadingState message="Carregando saldos de estoque físico..." />
  }

  return (
    <div className="space-y-6" id="stock-control-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Posição & Saldos de Estoque em Obra
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Quantitativo físico disponível formado pelas mobilizações e ledger imutável
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={handleOpenLedger}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            Extrato Ledger
          </button>

          {onNavigateToMobilizations && (
            <button
              type="button"
              onClick={onNavigateToMobilizations}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              <TrendingUp className="w-4 h-4" />
              Importar Nova Mobilização
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Disponível</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalAvailablePieces.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">peças livres para uso</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Área Total Disponível</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalAvailableAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">m² de fôrmas</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Reservado</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalReservedPieces.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">em paletização/carga</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Físico em Posição</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalAllPieces.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">peças totais</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por código ou descrição do material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* Location Selector */}
          <div className="relative">
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="all">Todas as Localizações (Obras e Galpões)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  [{loc.type}] {loc.code} - {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      {aggregatedList.length === 0 ? (
        <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8">
          <EmptyState
            title="Nenhum saldo em estoque encontrado"
            description={
              balances.length === 0
                ? 'Nenhum material foi mobilizado para esta obra ainda. Realize a importação de uma planilha de mobilização para formar o estoque inicial.'
                : 'Nenhum material corresponde aos filtros de busca.'
            }
            actionLabel={onNavigateToMobilizations ? 'Importar Mobilização' : undefined}
            onAction={onNavigateToMobilizations}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-850/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Localização / Obra</th>
                  <th className="py-3 px-4">Código Material</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-center">Dimensões (mm)</th>
                  <th className="py-3 px-4 text-right">Disponível</th>
                  <th className="py-3 px-4 text-right">Reservado</th>
                  <th className="py-3 px-4 text-right">Total Físico</th>
                  <th className="py-3 px-4 text-right">Área Unitária</th>
                  <th className="py-3 px-4 text-right">Área Disponível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                {aggregatedList.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.location?.code}
                          </span>
                          <p className="text-[11px] text-zinc-400 truncate max-w-[150px]">
                            {item.location?.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {item.material?.code}
                    </td>

                    <td className="py-3 px-4 text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-[220px]">
                      {item.material?.name}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-zinc-500">
                      {item.material?.width_mm && item.material?.height_mm
                        ? `${item.material.width_mm} × ${item.material.height_mm}`
                        : '---'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.availableQty.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-500">
                      {item.reservedQty.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {item.totalQty.toLocaleString('pt-BR')}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-zinc-500">
                      {item.unitAreaM2.toFixed(2)} m²
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.totalAvailableAreaM2.toFixed(2)} m²
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger Movements Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Extrato do Ledger Imutável (stock_movements)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingMovements ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  Carregando lançamentos contábeis...
                </div>
              ) : movements.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  Nenhum lançamento no ledger encontrado.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-850 sticky top-0 uppercase font-semibold text-zinc-500">
                    <tr>
                      <th className="py-2 px-3">Data/Hora</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3 text-right">Qtd</th>
                      <th className="py-2 px-3">Bucket</th>
                      <th className="py-2 px-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-zinc-500">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 font-semibold text-blue-600 dark:text-blue-400">
                          {m.movement_type}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {m.quantity}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {m.destination_bucket}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-500 truncate max-w-[280px]">
                          {m.notes || '---'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 transition"
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
