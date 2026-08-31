import React, { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  Search,
  RefreshCw,
  Plus,
  ArrowRight,
  Boxes,
  Building2,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MapPin,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { DemobilizationPalletWithDetails, Location } from '../../types'
import { demobilizationService } from '../../services/demobilizationService'
import { locationService } from '../../services/locationService'
import { StatusBadge } from '../../components/common/StatusBadge'
import { MetricCard } from '../../components/common/MetricCard'
import { PageHeader } from '../../components/common/PageHeader'
import { supabase } from '../../lib/supabase'

interface PalletsOverviewPageProps {
  onNavigate?: (path: string) => void
  onSelectPallet?: (palletId: string, demobId?: string) => void
}

export const PalletsOverviewPage: React.FC<PalletsOverviewPageProps> = ({
  onNavigate,
  onSelectPallet,
}) => {
  const { profile, isAdmin, canAccessLocation } = useAuth()

  const [pallets, setPallets] = useState<DemobilizationPalletWithDetails[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedWorkId, setSelectedWorkId] = useState('all')

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const [locs, { data: palletsData }] = await Promise.all([
        locationService.listLocations(),
        supabase
          .from('demobilization_pallets')
          .select(`
            *,
            origin_location:locations!origin_location_id(*),
            destination_location:locations!destination_location_id(*),
            creator:profiles!created_by(name, email),
            items:demobilization_pallet_items(
              *,
              material:materials(*)
            )
          `)
          .order('created_at', { ascending: false }),
      ])

      const list = ((palletsData || []) as unknown as DemobilizationPalletWithDetails[]).filter((p) => {
        if (isAdmin || profile?.role === 'ANALISTA_LOGISTICA' || profile?.role === 'DIRETOR') {
          return true
        }
        return canAccessLocation(p.origin_location_id)
      })

      setPallets(list)
      setLocations(locs)
    } catch (err) {
      console.error('Erro ao carregar pallets:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredPallets = useMemo(() => {
    return pallets.filter((p) => {
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false
      if (selectedWorkId !== 'all' && p.origin_location_id !== selectedWorkId) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const code = p.code?.toLowerCase() || ''
        const workName = p.origin_location?.name?.toLowerCase() || ''
        const workCode = p.origin_location?.code?.toLowerCase() || ''
        return code.includes(term) || workName.includes(term) || workCode.includes(term)
      }
      return true
    })
  }, [pallets, selectedStatus, selectedWorkId, searchTerm])

  const totalPallets = pallets.length
  const totalAssembly = pallets.filter((p) => p.status === 'EM_MONTAGEM').length
  const totalReady = pallets.filter((p) => p.status === 'PRONTO').length
  const totalPieces = pallets
    .filter((p) => p.status !== 'DESMONTADO' && p.status !== 'CANCELADO')
    .reduce((acc, p) => acc + (p.total_pieces || 0), 0)
  const totalArea = pallets
    .filter((p) => p.status !== 'DESMONTADO' && p.status !== 'CANCELADO')
    .reduce((acc, p) => acc + (p.total_area_m2 || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Pallets de Desmobilização"
        description="Controle e montagem de volumes, reserva atômica de peças e preparação para transporte"
        action={
          <button
            onClick={() => loadData(false)}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Total de Pallets"
          value={totalPallets}
          subtitle="Pallets registrados no sistema"
          icon={<Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />
        <MetricCard
          title="Em Montagem"
          value={totalAssembly}
          subtitle="Abertos para inclusão de itens"
          icon={<Layers className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        />
        <MetricCard
          title="Prontos para Carga"
          value={totalReady}
          subtitle="Prontos para expedição"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          title="Peças Paletizadas"
          value={totalPieces.toLocaleString('pt-BR')}
          subtitle="Peças atualmente em pallets"
          icon={<Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
        <MetricCard
          title="Área Paletizada"
          value={`${totalArea.toFixed(2)} m²`}
          subtitle="Metragem total reservada"
          icon={<ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código ou obra..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Status</option>
              <option value="EM_MONTAGEM">Em Montagem</option>
              <option value="PRONTO">Pronto</option>
              <option value="EMBARCADO">Embarcado</option>
              <option value="EM_TRANSITO">Em Trânsito</option>
              <option value="DESMONTADO">Desmontado</option>
            </select>
          </div>

          <div>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as Obras de Origem</option>
              {locations
                .filter((l) => l.type === 'OBRA')
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pallets List Table */}
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] text-zinc-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Código Pallet</th>
                <th className="py-3 px-4">Obra de Origem</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Itens Distintos</th>
                <th className="py-3 px-4 text-right">Qtd Peças</th>
                <th className="py-3 px-4 text-right">Área Total</th>
                <th className="py-3 px-4">Criado por</th>
                <th className="py-3 px-4">Data Criação</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Carregando pallets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPallets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Layers className="w-8 h-8 mx-auto text-zinc-400" />
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhum pallet encontrado</p>
                      <p className="text-[11px] text-zinc-500">
                        Acesse a página de Desmobilização de uma obra para criar novos pallets.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPallets.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      if (onSelectPallet) onSelectPallet(p.id, p.demobilization_id)
                    }}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {p.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>
                          {p.origin_location?.code} — {p.origin_location?.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-zinc-700 dark:text-zinc-300">
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
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onSelectPallet) onSelectPallet(p.id, p.demobilization_id)
                        }}
                        className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-semibold transition-all inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Abrir</span>
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
  )
}
