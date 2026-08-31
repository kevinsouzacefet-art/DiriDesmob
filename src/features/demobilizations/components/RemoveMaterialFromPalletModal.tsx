import React, { useState, useEffect } from 'react'
import { X, MinusCircle, AlertCircle, Loader2, ArrowLeftRight } from 'lucide-react'
import { DemobilizationPalletItemWithMaterial } from '../../../types'
import { demobilizationService } from '../../../services/demobilizationService'

interface RemoveMaterialFromPalletModalProps {
  isOpen: boolean
  palletId: string
  palletCode: string
  item: DemobilizationPalletItemWithMaterial | null
  onClose: () => void
  onSuccess: (data?: any) => void
}

export const RemoveMaterialFromPalletModal: React.FC<RemoveMaterialFromPalletModalProps> = ({
  isOpen,
  palletId,
  palletCode,
  item,
  onClose,
  onSuccess,
}) => {
  const [quantityInput, setQuantityInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && item) {
      setQuantityInput(String(item.quantity))
      setError(null)
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  const maxInPallet = Number(item.quantity)
  const parsedQuantity = parseInt(quantityInput, 10) || 0
  const unitArea = Number(item.material?.unit_area_m2 || 0)
  const calculatedArea = (parsedQuantity * unitArea).toFixed(2)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (parsedQuantity <= 0) {
      setError('A quantidade a remover deve ser maior que zero.')
      return
    }

    if (parsedQuantity > maxInPallet) {
      setError(`Quantidade a remover (${parsedQuantity}) excede a quantidade atual no pallet (${maxInPallet}).`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const idempotencyKey = `rem-mat-${palletId}-${item.material_id}-${Date.now()}`
      const result = await demobilizationService.removeMaterialFromPallet(
        palletId,
        item.material_id,
        parsedQuantity,
        idempotencyKey
      )

      if (!result.success) {
        setError(result.error || 'Erro ao remover material do pallet.')
        setIsSubmitting(false)
        return
      }

      onSuccess(result.data)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao remover material.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <MinusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                Remover Material do Pallet
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pallet: <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{palletCode}</span>
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

          <div className="p-3 bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Material:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{item.material?.code}</span>
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              {item.material?.name}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 text-zinc-500">
              <span>Quantidade Atual no Pallet:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{maxInPallet} peças</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Quantidade a Remover / Despaletizar
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max={maxInPallet}
                step="1"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder={`1 a ${maxInPallet}`}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#121a29] border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                required
              />
              <button
                type="button"
                onClick={() => setQuantityInput(String(maxInPallet))}
                className="px-3 h-10 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 transition-colors shrink-0"
              >
                Todas ({maxInPallet})
              </button>
            </div>
          </div>

          {parsedQuantity > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg space-y-1 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center space-x-1.5 font-semibold">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Liberação Automática de Estoque:</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                <strong>{parsedQuantity} peças</strong> ({calculatedArea} m²) transitarão de <strong className="font-semibold text-blue-600 dark:text-blue-400">RESERVADO</strong> de volta para <strong className="font-semibold text-emerald-600 dark:text-emerald-400">DISPONÍVEL</strong> no estoque da obra.
              </p>
            </div>
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
              disabled={isSubmitting || parsedQuantity <= 0 || parsedQuantity > maxInPallet}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Liberando...</span>
                </>
              ) : (
                <span>Confirmar Remoção</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
