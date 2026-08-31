import React, { useState, useEffect } from 'react'
import {
  PackageCheck,
  Upload,
  Download,
  Filter,
  Search,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Truck,
  RotateCw,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { MobilizationWithRelations, Location } from '../../types'
import { mobilizationService } from '../../services/mobilizationService'
import { locationService } from '../../services/locationService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface MobilizationsListPageProps {
  onNavigate: (path: string) => void
  onSelectMobilization: (id: string) => void
}

export const MobilizationsListPage: React.FC<MobilizationsListPageProps> = ({
  onNavigate,
  onSelectMobilization,
}) => {
  const { profile, isAdmin, isAnalyst } = useAuth()
  const [mobilizations, setMobilizations] = useState<MobilizationWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [selectedWorkId, setSelectedWorkId] = useState<string>('all')
  const [selectedOriginId, setSelectedOriginId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const canImport = isAdmin || isAnalyst

  const loadData = async () => {
    try {
      const [mobs, locs] = await Promise.all([
        mobilizationService.getMobilizations(),
        locationService.listLocations(),
      ])
      setMobilizations(mobs)
      setLocations(locs)
    } catch (err) {
      console.error('Erro ao carregar mobilizações:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  // Filtered Mobilizations
  const filteredMobs = mobilizations.filter((mob) => {
    if (selectedWorkId !== 'all' && mob.destination_work_id !== selectedWorkId) {
      return false
    }
    if (selectedOriginId !== 'all' && mob.origin_location_id !== selectedOriginId) {
      return false
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim()
      const codeMatch = mob.code.toLowerCase().includes(q)
      const workMatch = mob.destination_work?.name.toLowerCase().includes(q) || mob.destination_work?.code.toLowerCase().includes(q)
      const originMatch = mob.origin_location?.name.toLowerCase().includes(q) || mob.origin_location?.code.toLowerCase().includes(q)
      const notesMatch = mob.notes?.toLowerCase().includes(q)
      if (!codeMatch && !workMatch && !originMatch && !notesMatch) {
        return false
      }
    }
    return true
  })

  // Summary Metrics
  const totalMobilizedPieces = filteredMobs.reduce((sum, m) => sum + (m.total_pieces || 0), 0)
  const totalPallets = filteredMobs.reduce((sum, m) => sum + (m.total_pallets || 0), 0)
  const totalAreaM2 = filteredMobs.reduce((sum, m) => sum + Number(m.total_area_m2 || 0), 0)

  const workLocations = locations.filter((l) => l.type === 'OBRA')
  const originLocations = locations.filter((l) => l.type === 'GALPAO' || l.type === 'FORNECEDOR')

  if (isLoading) {
    return <LoadingState message="Carregando histórico de mobilizações de fôrmas..." />
  }

  return (
    <div className="space-y-6" id="mobilizations-list-module">
      {/* Header with Title and Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Mobilizações de Materiais
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Entrada oficial de fôrmas nas obras via importação estruturada e formação de estoque
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
            title="Atualizar lista"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => mobilizationService.downloadSampleTemplate()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            Baixar Modelo Excel
          </button>

          {canImport && (
            <button
              type="button"
              id="btn-importar-mobilizacao"
              onClick={() => onNavigate('/app/mobilizacoes/importar')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition"
            >
              <Upload className="w-4 h-4" />
              Importar Mobilização (Excel)
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total de Mobilizações</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {filteredMobs.length}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">remessas registradas</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total de Peças Entradas</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalMobilizedPieces.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">fôrmas / acessórios</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pallets de Remessa</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalPallets.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">volumes recebidos</span>
          </div>
        </div>

        <div className="p-4.5 rounded-xl bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Área Total Mobilizada</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-zinc-500 ml-1.5 font-normal">m² de contato</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por código, obra ou origem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* Obra Filter */}
          <div className="relative">
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="all">Todas as Obras Receptoras</option>
              {workLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} - {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Origin Filter */}
          <div className="relative">
            <select
              value={selectedOriginId}
              onChange={(e) => setSelectedOriginId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="all">Todas as Origens (Galpão / Fornecedor)</option>
              {originLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  [{loc.type}] {loc.code} - {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobilizations Table */}
      {filteredMobs.length === 0 ? (
        <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8">
          <EmptyState
            title="Nenhuma mobilização encontrada"
            description={
              mobilizations.length === 0
                ? 'Nenhum lote de mobilização foi importado até o momento. Clique em "Importar Mobilização (Excel)" para carregar sua primeira remessa.'
                : 'Nenhuma mobilização corresponde aos filtros selecionados.'
            }
            actionLabel={canImport && mobilizations.length === 0 ? 'Importar Primeira Mobilização' : undefined}
            onAction={canImport && mobilizations.length === 0 ? () => onNavigate('/app/mobilizacoes/importar') : undefined}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-850/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Código / Data</th>
                  <th className="py-3 px-4">Obra Receptora</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4 text-center">Pallets</th>
                  <th className="py-3 px-4 text-center">Peças</th>
                  <th className="py-3 px-4 text-right">Área Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                {filteredMobs.map((mob) => {
                  const dateStr = new Date(mob.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={mob.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group cursor-pointer"
                      onClick={() => onSelectMobilization(mob.id)}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex flex-col">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">{mob.code}</span>
                          <span className="text-[11px] text-zinc-400">{dateStr}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                          <div>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {mob.destination_work?.code || '---'}
                            </span>
                            <p className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                              {mob.destination_work?.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                            {mob.origin_location?.code || 'Múltiplas origens'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                          {mob.total_pallets || 0}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {(mob.total_pieces || 0).toLocaleString('pt-BR')}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {Number(mob.total_area_m2 || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-zinc-400 font-normal">m²</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluída
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectMobilization(mob.id)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes
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
    </div>
  )
}
