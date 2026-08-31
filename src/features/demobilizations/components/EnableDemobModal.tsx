import React, { useState, useEffect } from 'react'
import { X, Building2, MapPin, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Location } from '../../../types'
import { locationService } from '../../../services/locationService'
import { demobilizationService } from '../../../services/demobilizationService'

interface EnableDemobModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (demobId?: string) => void
}

export const EnableDemobModal: React.FC<EnableDemobModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [works, setWorks] = useState<Location[]>([])
  const [destinations, setDestinations] = useState<Location[]>([])
  const [selectedWorkId, setSelectedWorkId] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadLocations()
      setSelectedWorkId('')
      setSelectedTargetId('')
      setNotes('')
      setError(null)
    }
  }, [isOpen])

  const loadLocations = async () => {
    setIsLoading(true)
    try {
      const locs = await locationService.listLocations()
      setWorks(locs.filter((l) => l.type === 'OBRA' && l.is_active))
      setDestinations(locs.filter((l) => (l.type === 'GALPAO' || l.type === 'FORNECEDOR' || l.type === 'OBRA') && l.is_active))
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkId) {
      setError('Por favor, selecione a obra para desmobilização.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await demobilizationService.enableDemobilization(
        selectedWorkId,
        selectedTargetId ? selectedTargetId : null,
        notes.trim() || undefined
      )

      if (!result.success) {
        setError(result.error || 'Erro ao habilitar desmobilização.')
        setIsSubmitting(false)
        return
      }

      onSuccess(result.demobilization_id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro inesperado na habilitação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                Habilitar Desmobilização de Obra
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Abre o ciclo operacional da obra para montagem e reserva de pallets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-xs text-zinc-500">Carregando obras e localizações...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Obra de Origem <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedWorkId}
                  onChange={(e) => setSelectedWorkId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione a obra...</option>
                  {works.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Apenas o Administrador pode habilitar novas desmobilizações.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Destino Previsto Planejado (Opcional)
                </label>
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Destino ainda não definido (pode ser definido depois)</option>
                  {destinations
                    .filter((d) => d.id !== selectedWorkId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.type}] {d.code} — {d.name}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  O destino previsto não movimenta estoque; serve como guia para a equipe operacional.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Observações / Diretrizes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Priorizar recolhimento de fôrmas do Bloco B e escoramento..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-start space-x-2 text-xs text-blue-700 dark:text-blue-400">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                  <div>
                    <span className="font-semibold">Regra Operacional:</span> Ao habilitar, o status inicial será <span className="font-mono font-medium">DISPONÍVEL</span>. Assim que a obra criar o primeiro pallet com reserva de material, o estado mudará atomicamente para <span className="font-mono font-medium">EM DESMOBILIZAÇÃO</span>.
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading || !selectedWorkId}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Habilitando...</span>
                </>
              ) : (
                <span>Confirmar Habilitação</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
