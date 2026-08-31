import React, { useState, useEffect } from 'react'
import { loadService } from '../../services/loadService'
import { locationService } from '../../services/locationService'
import { LoadWithRelations, Location, LoadStatus } from '../../types'
import {
  Truck,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Package,
  Calendar,
  MapPin,
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { LoadingState } from '../../components/common/FeedbackStates'
import { LoadManifestPrintModal } from './LoadManifestPrintModal'

interface LoadsListPageProps {
  onNavigate: (path: string) => void
  onSelectLoad: (id: string) => void
}

export const LoadsListPage: React.FC<LoadsListPageProps> = ({ onNavigate, onSelectLoad }) => {
  const [loads, setLoads] = useState<LoadWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [originFilter, setOriginFilter] = useState<string>('all')
  const [destinationFilter, setDestinationFilter] = useState<string>('all')
  const [onlyDelayed, setOnlyDelayed] = useState(false)

  // Create Load Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newOriginId, setNewOriginId] = useState('')
  const [newDestinationId, setNewDestinationId] = useState('')
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newDriverName, setNewDriverName] = useState('')
  const [newCarrierName, setNewCarrierName] = useState('')
  const [newDepartureDate, setNewDepartureDate] = useState('')
  const [newExpectedArrivalDate, setNewExpectedArrivalDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Print Romaneio Modal
  const [selectedLoadForPrint, setSelectedLoadForPrint] = useState<LoadWithRelations | null>(null)

  const loadData = async () => {
    try {
      const [fetchedLoads, fetchedLocations] = await Promise.all([
        loadService.getLoads({
          status: statusFilter,
          originLocationId: originFilter,
          destinationLocationId: destinationFilter,
          isDelayed: onlyDelayed,
          search: searchTerm,
        }),
        locationService.listLocations(),
      ])

      setLoads(fetchedLoads)
      setLocations(fetchedLocations.filter((l) => l.is_active))
    } catch (err) {
      console.error('Erro ao carregar dados de cargas:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter, originFilter, destinationFilter, onlyDelayed, searchTerm])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!newOriginId) {
      setCreateError('Selecione a localização de origem.')
      return
    }
    if (!newDestinationId) {
      setCreateError('Selecione a localização de destino.')
      return
    }
    if (newOriginId === newDestinationId) {
      setCreateError('A origem e o destino não podem ser iguais.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await loadService.createLoad({
        originLocationId: newOriginId,
        destinationLocationId: newDestinationId,
        vehiclePlate: newVehiclePlate.trim(),
        driverName: newDriverName.trim(),
        carrierName: newCarrierName.trim(),
        departureDate: newDepartureDate || undefined,
        expectedArrivalDate: newExpectedArrivalDate || undefined,
        notes: newNotes.trim() || undefined,
      })

      if (!result.success) {
        setCreateError(result.error || 'Falha ao criar carga.')
        return
      }

      setIsCreateModalOpen(false)
      // Reset form
      setNewOriginId('')
      setNewDestinationId('')
      setNewVehiclePlate('')
      setNewDriverName('')
      setNewCarrierName('')
      setNewDepartureDate('')
      setNewExpectedArrivalDate('')
      setNewNotes('')

      if (result.load_id) {
        onSelectLoad(result.load_id)
      } else {
        loadData()
      }
    } catch (err: any) {
      setCreateError(err.message || 'Erro inesperado ao criar carga.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Summary Metrics
  const totalLoads = loads.length
  const draftOrReadyCount = loads.filter(
    (l) => l.status === 'RASCUNHO' || l.status === 'PRONTA_PARA_ENVIO'
  ).length
  const inTransitCount = loads.filter(
    (l) => l.status === 'ENVIADA' || l.status === 'EM_TRANSITO'
  ).length
  const delayedCount = loads.filter((l) => l.is_delayed).length

  const getStatusBadge = (status: LoadStatus, isDelayed?: boolean) => {
    switch (status) {
      case 'RASCUNHO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
            Rascunho
          </span>
        )
      case 'PRONTA_PARA_ENVIO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-500" />
            Pronta para Envio
          </span>
        )
      case 'ENVIADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Truck className="w-3 h-3 text-sky-500" />
            Enviada (Expedida)
          </span>
        )
      case 'EM_TRANSITO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Truck className="w-3 h-3 text-indigo-500 animate-pulse" />
            Em Trânsito
          </span>
        )
      case 'RECEBIDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <CheckCircle2 className="w-3 h-3 text-purple-500" />
            Recebida
          </span>
        )
      case 'EM_CONFERENCIA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3 text-blue-500" />
            Em Conferência
          </span>
        )
      case 'CONFERIDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            Conferida
          </span>
        )
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Finalizada
          </span>
        )
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-500" />
            Cancelada
          </span>
        )
      default:
        return <span className="text-xs">{status}</span>
    }
  }

  const handleOpenPrint = async (load: LoadWithRelations, e: React.MouseEvent) => {
    e.stopPropagation()
    const fullLoad = await loadService.getLoadById(load.id)
    if (fullLoad) {
      setSelectedLoadForPrint(fullLoad)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Cargas & Romaneios de Transporte
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gestão de cargas, manifesto rodoviário, despacho e controle de estoque em trânsito
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Carga
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total de Cargas</span>
            <Truck className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalLoads}</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Rascunho / Prontas</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{draftOrReadyCount}</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Em Trânsito / Enviadas</span>
            <Truck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{inTransitCount}</div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Atrasadas</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{delayedCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar código, placa, motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-300"
            >
              <option value="all">Todos os Status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="PRONTA_PARA_ENVIO">Pronta para Envio</option>
              <option value="ENVIADA">Enviada (Expedida)</option>
              <option value="EM_TRANSITO">Em Trânsito</option>
              <option value="RECEBIDA">Recebida</option>
              <option value="EM_CONFERENCIA">Em Conferência</option>
              <option value="CONFERIDA">Conferida</option>
              <option value="FINALIZADA">Finalizada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          {/* Origin Filter */}
          <div>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-300"
            >
              <option value="all">Todas as Origens</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  Origem: {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Filter */}
          <div>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-300"
            >
              <option value="all">Todos os Destinos</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  Destino: {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delayed Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyDelayed}
              onChange={(e) => setOnlyDelayed(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
            />
            <span>Filtrar apenas cargas com previsão de chegada atrasada</span>
          </label>

          <span className="text-zinc-400">
            Mostrando {loads.length} {loads.length === 1 ? 'carga' : 'cargas'}
          </span>
        </div>
      </div>

      {/* Loads Table / List */}
      {isLoading ? (
        <LoadingState message="Carregando cargas..." />
      ) : loads.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <Truck className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            Nenhuma carga encontrada
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Não há cargas cadastradas para os filtros selecionados. Crie uma nova carga para
            iniciar o agrupamento de pallets e despacho.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar primeira carga
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 text-xs font-semibold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Origem & Destino</th>
                  <th className="px-4 py-3 text-center">Pallets</th>
                  <th className="px-4 py-3 text-right">Peças & Área</th>
                  <th className="px-4 py-3">Veículo / Motorista</th>
                  <th className="px-4 py-3">Datas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loads.map((load) => (
                  <tr
                    key={load.id}
                    onClick={() => onSelectLoad(load.id)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Code */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                        {load.code}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {new Date(load.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {getStatusBadge(load.status, load.is_delayed)}
                        {load.is_delayed && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-3 h-3" />
                            Chegada em Atraso
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Origin & Destination */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                          <span className="text-[10px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 rounded font-semibold text-zinc-500">
                            DE
                          </span>
                          <span>{load.origin_location?.name || 'Origem'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                          <span className="text-[10px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 rounded font-semibold text-zinc-500">
                            PARA
                          </span>
                          <span>{load.destination_location?.name || 'Destino'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Pallets Count */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {load.pallets_count || 0}
                      </span>
                    </td>

                    {/* Pieces & Area */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                        {load.total_pieces || 0} un
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {load.total_area_m2?.toFixed(2) || '0.00'} m²
                      </div>
                    </td>

                    {/* Vehicle & Driver */}
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {load.vehicle_plate || '— Placa não inf.'}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {load.driver_name || '— Motorista'}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3.5 text-xs">
                      <div className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                        Saída: {load.departure_date ? new Date(load.departure_date).toLocaleDateString('pt-BR') : '—'}
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                        Prev.: {load.expected_arrival_date ? new Date(load.expected_arrival_date).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={(e) => handleOpenPrint(load, e)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Imprimir Romaneio"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onSelectLoad(load.id)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                        title="Ver Detalhes da Carga"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Load Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Nova Carga de Transporte
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoad} className="p-6 space-y-4 text-sm">
              {createError && (
                <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Origin & Destination Select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Localização de Origem *
                  </label>
                  <select
                    required
                    value={newOriginId}
                    onChange={(e) => setNewOriginId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs"
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
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Localização de Destino *
                  </label>
                  <select
                    required
                    value={newDestinationId}
                    onChange={(e) => setNewDestinationId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    <option value="">Selecione o destino...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id} disabled={loc.id === newOriginId}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transport Data */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    placeholder="ABC-1234 ou ABC1D23"
                    value={newVehiclePlate}
                    onChange={(e) => setNewVehiclePlate(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg font-mono uppercase text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nome do Motorista
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Transportadora
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rápido Rodoviário"
                    value={newCarrierName}
                    onChange={(e) => setNewCarrierName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Data de Saída Prevista
                  </label>
                  <input
                    type="date"
                    value={newDepartureDate}
                    onChange={(e) => setNewDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Previsão de Chegada
                  </label>
                  <input
                    type="date"
                    value={newExpectedArrivalDate}
                    onChange={(e) => setNewExpectedArrivalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Observações Gerais
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o transporte..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Criar Carga (Rascunho)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Romaneio Modal */}
      {selectedLoadForPrint && (
        <LoadManifestPrintModal
          load={selectedLoadForPrint}
          isOpen={Boolean(selectedLoadForPrint)}
          onClose={() => setSelectedLoadForPrint(null)}
        />
      )}
    </div>
  )
}
