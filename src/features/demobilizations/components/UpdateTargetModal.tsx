import React, { useState, useEffect } from 'react'
import { X, MapPin, AlertCircle, Loader2 } from 'lucide-react'
import { Location } from '../../../types'
import { locationService } from '../../../services/locationService'
import { demobilizationService } from '../../../services/demobilizationService'

interface UpdateTargetModalProps {
  isOpen: boolean
  demobilizationId: string
  currentWorkId: string
  currentTargetId: string | null
  currentNotes?: string | null
  onClose: () => void
  onSuccess: () => void
}

export const UpdateTargetModal: React.FC<UpdateTargetModalProps> = ({
  isOpen,
  demobilizationId,
  currentWorkId,
  currentTargetId,
  currentNotes,
  onClose,
  onSuccess,
}) => {
  const [destinations, setDestinations] = useState<Location[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState(currentTargetId || '')
  const [notes, setNotes] = useState(currentNotes || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadLocations()
      setSelectedTargetId(currentTargetId || '')
      setNotes(currentNotes || '')
      setError(null)
    }
  }, [isOpen, currentTargetId, currentNotes])

  const loadLocations = async () => {
    setIsLoading(true)
    try {
      const locs = await locationService.listLocations()
      setDestinations(locs.filter((l) => (l.type === 'GALPAO' || l.type === 'FORNECEDOR' || l.type === 'OBRA') && l.is_active && l.id !== currentWorkId))
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await demobilizationService.updateDemobilizationTarget(
        demobilizationId,
        selectedTargetId ? selectedTargetId : null,
        notes.trim() || undefined
      )

      if (!result.success) {
        setError(result.error || 'Erro ao atualizar destino previsto.')
        setIsSubmitting(false)
        return
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar destino previsto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                Alterar Destino Previsto
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Planejamento logístico (não movimenta saldo de estoque)
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Destino Planejado
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Destino em aberto / A definir</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.type}] {d.code} — {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">
              Pode ser um Galpão da construtora, Fornecedor de locação ou outra Obra receptora.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Observações Atualizadas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Instruções adicionais..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

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
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Destino</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
