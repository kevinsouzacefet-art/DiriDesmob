import React, { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { conferenceService } from '../../services/conferenceService'
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Camera,
  Layers,
  Image as ImageIcon,
  Package,
  Eye,
  X,
} from 'lucide-react'
import { LoadingState, EmptyState } from '../../components/common/FeedbackStates'

interface DivergenceItem {
  id: string
  type: string
  status: string
  expected_qty: number | null
  received_qty: number | null
  difference_qty: number | null
  notes: string | null
  created_at: string
  material?: {
    code: string
    name: string
  } | null
  pallet?: {
    code: string
  } | null
  photos?: {
    id: string
    storage_path: string
    file_name: string
  }[]
}

interface DivergencesListPageProps {
  onNavigateToConference?: (loadId: string) => void
}

export const DivergencesListPage: React.FC<DivergencesListPageProps> = ({
  onNavigateToConference,
}) => {
  const [divergences, setDivergences] = useState<DivergenceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)

  const fetchDivergences = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('divergences')
          .select(`
            *,
            material:materials(code, name),
            pallet:demobilization_pallets(code),
            photos:discrepancy_photos(*)
          `)
          .order('created_at', { ascending: false })

        if (!error && data) {
          setDivergences(data as any)
        }
      } catch (err) {
        console.error('Erro ao buscar divergências:', err)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Local fallback dummy items
    setDivergences([
      {
        id: 'div-1',
        type: 'PALLET_DANIFICADO',
        status: 'PENDENTE',
        expected_qty: 40,
        received_qty: 38,
        difference_qty: 2,
        notes: 'Pallet sofreu impacto durante transporte, 2 peças rachadas no canto superior.',
        created_at: new Date().toISOString(),
        material: { code: 'FORMA-ALU-01', name: 'Painel Alumínio 600x2400' },
        pallet: { code: 'PAL-000001' },
        photos: [],
      },
    ])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchDivergences()
  }, [])

  const filteredDivergences = divergences.filter((d) => {
    const matchesSearch =
      (d.material?.name && d.material.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.material?.code && d.material.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.pallet?.code && d.pallet.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = typeFilter === 'all' || d.type === typeFilter
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter

    return matchesSearch && matchesType && matchesStatus
  })

  const openPhoto = async (photo: any) => {
    if (photo.storage_path.startsWith('http') || photo.storage_path.startsWith('blob')) {
      setSelectedPhotoUrl(photo.storage_path)
    } else {
      const url = await conferenceService.getSignedPhotoUrl(photo.storage_path)
      setSelectedPhotoUrl(url)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Tratativa de Divergências & Ocorrências
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Faltas, sobras, avarias e fotos registradas durante a conferência de cargas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por material, código de pallet ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="FALTA">Falta de Peças</option>
            <option value="SOBRA">Sobra de Peças</option>
            <option value="SUCATA">Sucata / Condenada</option>
            <option value="PALLET_DANIFICADO">Pallet Danificado</option>
            <option value="MATERIAL_DIFERENTE">Material Trocado</option>
            <option value="OUTRO">Outras Ocorrências</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANALISE">Em Análise</option>
            <option value="RESOLVIDA">Resolvida</option>
            <option value="APROVADA">Aprovada</option>
            <option value="REJEITADA">Rejeitada</option>
          </select>
        </div>
      </div>

      {/* Divergences List */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingState message="Carregando ocorrências e divergências..." />
        </div>
      ) : filteredDivergences.length === 0 ? (
        <EmptyState
          title="Nenhuma divergência registrada"
          description="Não há apontamentos de faltas, sobras ou avarias pendentes com os filtros atuais."
        />
      ) : (
        <div className="space-y-3">
          {filteredDivergences.map((div) => (
            <div
              key={div.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    div.type === 'FALTA' || div.type === 'SUCATA'
                      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                      : div.type === 'SOBRA'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {div.type.replace(/_/g, ' ')}
                    </span>
                    {div.pallet?.code && (
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        {div.pallet.code}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {div.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                    {div.material?.name || 'Ocorrência Geral no Pallet'}
                  </h4>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl">
                    {div.notes || 'Sem observações adicionais'}
                  </p>

                  {(div.expected_qty !== null || div.received_qty !== null) && (
                    <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 mt-2 font-mono">
                      <span>Previsto: {div.expected_qty ?? '-'} un</span>
                      <span>|</span>
                      <span>Conferido: {div.received_qty ?? '-'} un</span>
                      {div.difference_qty !== null && (
                        <>
                          <span>|</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            Diferença: {div.difference_qty} un
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Photos & View */}
              {div.photos && div.photos.length > 0 && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {div.photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => openPhoto(photo)}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Ver Foto"
                    >
                      <Camera className="w-4 h-4 text-blue-500" />
                      <span>Ver Foto</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-500" />
                Foto Comprobatória da Divergência
              </span>
              <button
                onClick={() => setSelectedPhotoUrl(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
              <img
                src={selectedPhotoUrl}
                alt="Divergência"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
