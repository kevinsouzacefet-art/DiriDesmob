import React, { useState, useEffect } from 'react'
import { loadService } from '../../services/loadService'
import { locationService } from '../../services/locationService'
import { LoadWithRelations, Location } from '../../types'
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Truck,
  Building2,
  Warehouse,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface ConferencesListPageProps {
  onNavigate: (path: string) => void
  onSelectLoadForConference: (loadId: string) => void
}

export const ConferencesListPage: React.FC<ConferencesListPageProps> = ({
  onNavigate,
  onSelectLoadForConference,
}) => {
  const [loads, setLoads] = useState<LoadWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [destinationFilter, setDestinationFilter] = useState<string>('all')

  const fetchLoads = async () => {
    try {
      const [allLoads, allLocations] = await Promise.all([
        loadService.getLoads(),
        locationService.listLocations(),
      ])
      // Filter for loads in receipt/conference scope (RECEBIDA, EM_CONFERENCIA, CONFERIDA, or EM_TRANSITO arriving)
      const conferenceScopeLoads = allLoads.filter((l) =>
        ['EM_TRANSITO', 'RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA'].includes(l.status)
      )
      setLoads(conferenceScopeLoads)
      setLocations(allLocations)
    } catch (err) {
      console.error('Erro ao buscar cargas para conferência:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLoads()
  }, [])

  const filteredLoads = loads.filter((load) => {
    const matchesSearch =
      load.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (load.vehicle_plate && load.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (load.driver_name && load.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (load.origin_location?.name &&
        load.origin_location.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (load.destination_location?.name &&
        load.destination_location.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || load.status === statusFilter
    const matchesDest =
      destinationFilter === 'all' || load.destination_location_id === destinationFilter

    return matchesSearch && matchesStatus && matchesDest
  })

  const pendingConferenceCount = loads.filter((l) =>
    ['RECEBIDA', 'EM_CONFERENCIA'].includes(l.status)
  ).length
  const inTransitCount = loads.filter((l) => l.status === 'EM_TRANSITO').length
  const conferidaCount = loads.filter((l) => l.status === 'CONFERIDA').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Conferências de Recebimento
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Recepção física, contagem cega/assistida por pallet e apuração de divergências
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Aguardando Conferência
            </span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {pendingConferenceCount}
            </div>
            <span className="text-xs text-zinc-400">Pátio do destino</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Em Trânsito (A Chegar)
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {inTransitCount}
            </div>
            <span className="text-xs text-zinc-400">Na estrada</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Conferidas / Finalizadas
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {conferidaCount}
            </div>
            <span className="text-xs text-zinc-400">Estoque integrado</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código da carga, placa, motorista ou local..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Status</option>
            <option value="EM_TRANSITO">Em Trânsito</option>
            <option value="RECEBIDA">Recebida</option>
            <option value="EM_CONFERENCIA">Em Conferência</option>
            <option value="CONFERIDA">Conferida</option>
            <option value="FINALIZADA">Finalizada</option>
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Destinos</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loads List */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingState message="Carregando cargas para conferência..." />
        </div>
      ) : filteredLoads.length === 0 ? (
        <EmptyState
          title="Nenhuma carga encontrada"
          description="Não há cargas aguardando ou em conferência com os filtros selecionados."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLoads.map((load) => {
            const isReadyForConference = ['RECEBIDA', 'EM_CONFERENCIA'].includes(load.status)

            return (
              <div
                key={load.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {load.code}
                    </span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
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
                      {load.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{load.origin_location?.name || 'Origem'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      <Warehouse className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{load.destination_location?.name || 'Destino'}</span>
                    </div>
                  </div>

                  {/* Quick Meta */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-zinc-100 dark:border-zinc-800/80 pt-3 mb-4">
                    <div>
                      <span className="text-zinc-400">Pallets na Carga:</span>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {load.pallets_count} pallets
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-400">Veículo:</span>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {load.vehicle_plate || 'Sem placa'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <button
                  onClick={() => onSelectLoadForConference(load.id)}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isReadyForConference
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {load.status === 'RECEBIDA' ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Iniciar Conferência
                    </>
                  ) : load.status === 'EM_CONFERENCIA' ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      Continuar Conferência
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-3.5 h-3.5" />
                      Ver Detalhes / Histórico
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
