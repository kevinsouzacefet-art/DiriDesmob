import React, { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Package,
  Layers,
  ArrowRight,
  Filter,
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderSync
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { DemobilizationWithRelations, Location } from '../../types'
import { demobilizationService } from '../../services/demobilizationService'
import { locationService } from '../../services/locationService'
import { StatusBadge } from '../../components/common/StatusBadge'
import { MetricCard } from '../../components/common/MetricCard'
import { PageHeader } from '../../components/common/PageHeader'
import { EnableDemobModal } from './components/EnableDemobModal'

interface DemobilizationsListPageProps {
  onNavigate?: (path: string) => void
  onSelectDemobilization?: (id: string) => void
}

export const DemobilizationsListPage: React.FC<DemobilizationsListPageProps> = ({
  onNavigate,
  onSelectDemobilization,
}) => {
  const { profile, isAdmin, canAccessLocation } = useAuth()

  const [demobilizations, setDemobilizations] = useState<DemobilizationWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [selectedWorkId, setSelectedWorkId] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedTargetId, setSelectedTargetId] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false)

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const [demobs, locs] = await Promise.all([
        demobilizationService.getDemobilizations(),
        locationService.listLocations(),
      ])

      // Filter by user location access if not admin/analyst
      const visibleDemobs = demobs.filter((d) => {
        if (isAdmin || profile?.role === 'ANALISTA_LOGISTICA' || profile?.role === 'DIRETOR') {
          return true
        }
        return canAccessLocation(d.work_id)
      })

      setDemobilizations(visibleDemobs)
      setLocations(locs)
    } catch (err) {
      console.error('Erro ao carregar desmobilizações:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered demobilizations
  const filteredDemobilizations = useMemo(() => {
    return demobilizations.filter((d) => {
      if (selectedWorkId !== 'all' && d.work_id !== selectedWorkId) return false
      if (selectedStatus !== 'all' && d.status !== selectedStatus) return false
      if (selectedTargetId !== 'all') {
        if (selectedTargetId === 'unassigned' && d.target_location_id !== null) return false
        if (selectedTargetId !== 'unassigned' && d.target_location_id !== selectedTargetId) return false
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const workName = d.work?.name?.toLowerCase() || ''
        const workCode = d.work?.code?.toLowerCase() || ''
        const targetName = d.target_location?.name?.toLowerCase() || ''
        const targetCode = d.target_location?.code?.toLowerCase() || ''
        return (
          workName.includes(term) ||
          workCode.includes(term) ||
          targetName.includes(term) ||
          targetCode.includes(term)
        )
      }
      return true
    })
  }, [demobilizations, selectedWorkId, selectedStatus, selectedTargetId, searchTerm])

  const handleOpenDemobilization = (id: string) => {
    if (onSelectDemobilization) {
      onSelectDemobilization(id)
    } else if (onNavigate) {
      onNavigate(`/app/desmobilizacoes/detalhe?id=${id}`)
    }
  }

  // KPIs
  const totalEnabled = demobilizations.length
  const totalInDemob = demobilizations.filter((d) => d.status === 'EM_DESMOBILIZACAO').length
  const totalPalletsReady = demobilizations.reduce((acc, d) => acc + (d.pallets_ready || 0), 0)
  const totalPalletsAssembly = demobilizations.reduce((acc, d) => acc + (d.pallets_in_assembly || 0), 0)
  const totalReservedArea = demobilizations.reduce((acc, d) => acc + (d.reserved_area_m2 || 0), 0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Desmobilização de Obras"
        description="Gestão de encerramento de obras, formação e conferência de pallets com reserva transacional de estoque"
        action={
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => loadData(false)}
              disabled={isRefreshing || isLoading}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsEnableModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Habilitar Obra</span>
              </button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Obras Habilitadas"
          value={totalEnabled}
          subtitle={`${totalInDemob} em desmobilização ativa`}
          icon={<Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />
        <MetricCard
          title="Pallets em Montagem"
          value={totalPalletsAssembly}
          subtitle="Pallets abertos sendo abastecidos"
          icon={<Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        />
        <MetricCard
          title="Pallets Prontos"
          value={totalPalletsReady}
          subtitle="Aguardando formação de carga"
          icon={<Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          title="Área Total Reservada"
          value={`${totalReservedArea.toFixed(2)} m²`}
          subtitle="Saldo bloqueado em pallets"
          icon={<FolderSync className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por obra ou destino..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Obra Filter */}
          <div>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as Obras</option>
              {locations
                .filter((l) => l.type === 'OBRA')
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Status</option>
              <option value="DISPONIVEL">Disponível</option>
              <option value="EM_DESMOBILIZACAO">Em desmobilização</option>
              <option value="PARCIALMENTE_DESMOBILIZADA">Parcialmente desmobilizada</option>
              <option value="DESMOBILIZADA">Desmobilizada</option>
            </select>
          </div>

          {/* Target Location Filter */}
          <div>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Destinos</option>
              <option value="unassigned">A Definir / Em Aberto</option>
              {locations
                .filter((l) => l.type === 'GALPAO' || l.type === 'FORNECEDOR')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.type}] {d.code} — {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] text-zinc-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Obra</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Destino Previsto</th>
                <th className="py-3 px-4 text-right">Peças Disponíveis</th>
                <th className="py-3 px-4 text-right">Peças Reservadas</th>
                <th className="py-3 px-4">Pallets</th>
                <th className="py-3 px-4 text-right">m² Reservado</th>
                <th className="py-3 px-4">Última Movimentação</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Carregando desmobilizações...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDemobilizations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Package className="w-8 h-8 mx-auto text-zinc-400" />
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhuma desmobilização encontrada</p>
                      <p className="text-[11px] text-zinc-500">
                        {isAdmin
                          ? 'Clique em "Habilitar Obra" para iniciar o ciclo de desmobilização e criação de pallets.'
                          : 'Nenhuma obra habilitada encontrada para seus filtros.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDemobilizations.map((d) => {
                  const palletsAssembly = d.pallets_in_assembly || 0
                  const palletsReady = d.pallets_ready || 0
                  const totalP = d.pallets_count || 0

                  return (
                    <tr
                      key={d.id}
                      onClick={() => handleOpenDemobilization(d.id)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      {/* Obra */}
                      <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                            {d.work?.code}
                          </span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {d.work?.name}
                          </span>
                        </div>
                        {d.work?.city && (
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {d.work.city} - {d.work.state}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={d.status} />
                      </td>

                      {/* Destino Previsto */}
                      <td className="py-3.5 px-4">
                        {d.target_location ? (
                          <div className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[160px]" title={d.target_location.name}>
                              [{d.target_location.type}] {d.target_location.code} — {d.target_location.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">A definir</span>
                        )}
                      </td>

                      {/* Peças Disponíveis */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {d.available_pieces?.toLocaleString('pt-BR') || 0}
                      </td>

                      {/* Peças Reservadas */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {d.reserved_pieces?.toLocaleString('pt-BR') || 0}
                      </td>

                      {/* Pallets */}
                      <td className="py-3.5 px-4">
                        {totalP === 0 ? (
                          <span className="text-zinc-400 text-[11px]">Nenhum pallet</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {totalP} {totalP === 1 ? 'pallet' : 'pallets'}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {palletsAssembly > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{palletsAssembly} montagem</span>}
                              {palletsAssembly > 0 && palletsReady > 0 && <span>, </span>}
                              {palletsReady > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{palletsReady} pronto</span>}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* m² Reservado */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {d.reserved_area_m2 ? `${d.reserved_area_m2.toFixed(2)} m²` : '0,00 m²'}
                      </td>

                      {/* Última Movimentação */}
                      <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>
                            {d.last_movement_at
                              ? new Date(d.last_movement_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDemobilization(d.id)
                          }}
                          className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Abrir</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Enable Demobilization */}
      <EnableDemobModal
        isOpen={isEnableModalOpen}
        onClose={() => setIsEnableModalOpen(false)}
        onSuccess={(newId) => {
          loadData()
          if (newId) {
            handleOpenDemobilization(newId)
          }
        }}
      />
    </div>
  )
}
