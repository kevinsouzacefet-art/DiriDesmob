import React, { useState, useEffect } from 'react'
import {
  Layers,
  Search,
  Filter,
  Calendar,
  Building2,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { StockMovement, StockMovementType, Location, Material } from '../../types'
import { locationService } from '../../services/locationService'
import { materialService } from '../../services/materialService'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

export const MovementsPage: React.FC = () => {
  const [movements, setMovements] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [locationFilter, setLocationFilter] = useState<string>('ALL')
  const [materialFilter, setMaterialFilter] = useState<string>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [locs, mats] = await Promise.all([
        locationService.getLocations(),
        materialService.listMaterials(),
      ])
      setLocations(locs)
      setMaterials(mats)

      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('stock_movements')
          .select(`
            *,
            material:materials(code, name),
            origin_location:locations!stock_movements_origin_location_id_fkey(id, name, type),
            destination_location:locations!stock_movements_destination_location_id_fkey(id, name, type),
            performer:profiles(full_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(200)

        if (!error && data) {
          setMovements(data)
        }
      } else {
        // Fallback local dummy movements
        setMovements([
          {
            id: 'mov-1',
            movement_type: 'CLASSIFICACAO_FORNECEDOR',
            quantity: 38,
            material: { code: 'FORMA-ALU-01', name: 'Painel Alumínio 600x2400' },
            origin_location: { name: 'Fornecedor Formas Brasil', type: 'FORNECEDOR' },
            destination_location: { name: 'Fornecedor Formas Brasil', type: 'FORNECEDOR' },
            notes: 'Classificado como REAPROVEITAVEL após conferência de carga.',
            created_at: new Date().toISOString(),
            performer: { full_name: 'Marcos Fornecedor' },
          },
          {
            id: 'mov-2',
            movement_type: 'RECONCILIACAO_EXCEDENTE',
            quantity: 3,
            material: { code: 'ESCORA-MET-02', name: 'Escora Metálica 3.20m' },
            origin_location: null,
            destination_location: { name: 'Galpão Central', type: 'GALPAO' },
            notes: 'Entrada física de sobra identificada na conferência de carga.',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            performer: { full_name: 'Carla Conferente' },
          },
        ])
      }
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
  }

  const filteredMovements = movements.filter((m) => {
    const matchesSearch =
      (m.material?.name && m.material.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.material?.code && m.material.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.notes && m.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = typeFilter === 'ALL' || m.movement_type === typeFilter
    const matchesMaterial = materialFilter === 'ALL' || m.material_id === materialFilter
    const matchesLocation =
      locationFilter === 'ALL' ||
      m.origin_location_id === locationFilter ||
      m.destination_location_id === locationFilter

    const matchesDate =
      (!startDate || new Date(m.created_at) >= new Date(`${startDate}T00:00:00Z`)) &&
      (!endDate || new Date(m.created_at) <= new Date(`${endDate}T23:59:59Z`))

    return matchesSearch && matchesType && matchesMaterial && matchesLocation && matchesDate
  })

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'MOBILIZACAO':
      case 'RECEBIMENTO_CARGA':
      case 'RECONCILIACAO_EXCEDENTE':
      case 'RECONCILIACAO_FALTANTE_LOCALIZADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <TrendingUp className="w-3 h-3" /> {type.replace(/_/g, ' ')}
          </span>
        )
      case 'DESMOBILIZACAO':
      case 'EXPEDICAO_CARGA':
      case 'SUCATA_BAIXA':
      case 'BAIXA_FALTANTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <TrendingDown className="w-3 h-3" /> {type.replace(/_/g, ' ')}
          </span>
        )
      case 'CLASSIFICACAO_FORNECEDOR':
      case 'TRANSFERENCIA':
      case 'MOVIMENTACAO_SUCATA':
      case 'RECONCILIACAO_MATERIAL_DIFERENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <RotateCcw className="w-3 h-3" /> {type.replace(/_/g, ' ')}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {type}
          </span>
        )
    }
  }

  if (isLoading) {
    return <LoadingState message="Carregando extrato do ledger de movimentações..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            Extrato do Ledger de Movimentações
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Histórico imutável de partidas dobradas e todas as transições físicas de material do sistema
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por material, código ou observações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">Todos os Tipos de Movimento</option>
              <option value="RECEBIMENTO_CARGA">Recebimento de Carga</option>
              <option value="EXPEDICAO_CARGA">Expedição de Carga</option>
              <option value="CLASSIFICACAO_FORNECEDOR">Classificação do Fornecedor</option>
              <option value="RECONCILIACAO_EXCEDENTE">Reconciliação de Excedente</option>
              <option value="RECONCILIACAO_FALTANTE_LOCALIZADO">Faltante Localizado</option>
              <option value="BAIXA_FALTANTE">Baixa de Falta Física</option>
              <option value="MOVIMENTACAO_SUCATA">Movimentação de Sucata</option>
              <option value="SUCATA_BAIXA">Baixa de Sucata</option>
              <option value="MOBILIZACAO">Mobilização</option>
              <option value="DESMOBILIZACAO">Desmobilização</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Localização:</span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">Todas as Localizações</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Material:</span>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate"
            >
              <option value="ALL">Todos os Materiais</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            />
            <span>Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-700 dark:text-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      {filteredMovements.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma movimentação encontrada"
          description="Nenhum registro de movimentação atende aos filtros atuais."
        />
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Data & Horário</th>
                  <th className="py-3 px-4">Tipo de Movimentação</th>
                  <th className="py-3 px-4">Material / Peça</th>
                  <th className="py-3 px-4">Origem → Destino</th>
                  <th className="py-3 px-4 text-center">Quantidade</th>
                  <th className="py-3 px-4">Responsável & Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {filteredMovements.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Data */}
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                        {new Date(m.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td className="py-3.5 px-4">
                      {getMovementBadge(m.movement_type)}
                    </td>

                    {/* Material */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                          {m.material?.code || '—'}
                        </span>
                        <span className="text-xs text-zinc-500 line-clamp-1">{m.material?.name}</span>
                      </div>
                    </td>

                    {/* Origem -> Destino */}
                    <td className="py-3.5 px-4 text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {m.origin_location?.name || 'Sistema / Ajuste'}
                      </span>
                      <span className="text-zinc-400 mx-1">→</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {m.destination_location?.name || 'Baixa Definitiva'}
                      </span>
                    </td>

                    {/* Quantidade */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {m.quantity} un
                      </span>
                    </td>

                    {/* Responsável & Obs */}
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 block">
                        {m.performer?.full_name || m.performer?.email || 'Sistema'}
                      </span>
                      {m.notes && <p className="text-zinc-500 line-clamp-1">{m.notes}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
