import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Layers, AlertCircle, CheckCircle2, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { StockBalanceWithDetails, Material } from '../../../types'
import { demobilizationService } from '../../../services/demobilizationService'

interface AddMaterialToPalletModalProps {
  isOpen: boolean
  palletId: string
  palletCode: string
  originLocationId: string
  onClose: () => void
  onSuccess: (data?: any) => void
}

export const AddMaterialToPalletModal: React.FC<AddMaterialToPalletModalProps> = ({
  isOpen,
  palletId,
  palletCode,
  originLocationId,
  onClose,
  onSuccess,
}) => {
  const [availableStock, setAvailableStock] = useState<StockBalanceWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && originLocationId) {
      loadAvailableStock()
      setSearchTerm('')
      setSelectedMaterialId(null)
      setQuantityInput('')
      setError(null)
    }
  }, [isOpen, originLocationId])

  const loadAvailableStock = async () => {
    setIsLoading(true)
    try {
      const balances = await demobilizationService.getWorkAvailableMaterials(originLocationId)
      setAvailableStock(balances)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim()) return availableStock
    const term = searchTerm.toLowerCase().trim()
    return availableStock.filter(
      (b) =>
        b.material?.code?.toLowerCase().includes(term) ||
        b.material?.name?.toLowerCase().includes(term)
    )
  }, [availableStock, searchTerm])

  const selectedBalance = useMemo(() => {
    return availableStock.find((b) => b.material_id === selectedMaterialId) || null
  }, [availableStock, selectedMaterialId])

  const parsedQuantity = parseInt(quantityInput, 10) || 0
  const maxAvailable = selectedBalance ? Number(selectedBalance.quantity) : 0
  const unitArea = selectedBalance ? Number(selectedBalance.material?.unit_area_m2 || 0) : 0
  const calculatedArea = (parsedQuantity * unitArea).toFixed(2)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaterialId) {
      setError('Selecione um material da lista de saldo disponível.')
      return
    }

    if (parsedQuantity <= 0) {
      setError('A quantidade deve ser um número inteiro maior que zero.')
      return
    }

    if (parsedQuantity > maxAvailable) {
      setError(`Quantidade solicitada (${parsedQuantity}) excede o saldo disponível na obra (${maxAvailable}).`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const idempotencyKey = `add-mat-${palletId}-${selectedMaterialId}-${Date.now()}`
      const result = await demobilizationService.addMaterialToPallet(
        palletId,
        selectedMaterialId,
        parsedQuantity,
        idempotencyKey
      )

      if (!result.success) {
        setError(result.error || 'Erro ao adicionar material ao pallet.')
        setIsSubmitting(false)
        return
      }

      onSuccess(result.data)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro inesperado na inclusão de material.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#121a29] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e1624] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                Adicionar Material ao Pallet
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pallet Destino: <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{palletCode}</span>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              1. Selecionar Material com Saldo Disponível
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por código ou descrição da fôrma..."
                className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Materials List */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <p className="text-xs text-zinc-500">Consultando estoque disponível na obra...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Nenhum material com saldo disponível encontrado para a pesquisa.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredMaterials.map((b) => {
                  const isSelected = b.material_id === selectedMaterialId
                  return (
                    <button
                      key={b.material_id}
                      type="button"
                      onClick={() => {
                        setSelectedMaterialId(b.material_id)
                        setError(null)
                      }}
                      className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            {b.material?.code}
                          </span>
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[220px]">
                            {b.material?.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Área unitária: <span className="font-mono font-medium">{Number(b.material?.unit_area_m2 || 0).toFixed(2)} m²</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {b.quantity} peças
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Disponível
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quantity Input */}
          {selectedBalance && (
            <div className="p-4 bg-zinc-50 dark:bg-[#0a0f18] border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Material Selecionado: <strong className="font-mono text-zinc-900 dark:text-zinc-100">{selectedBalance.material?.code}</strong> — {selectedBalance.material?.name}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Disponível: {maxAvailable} pçs
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  2. Quantidade a Reservar no Pallet
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={maxAvailable}
                    step="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    placeholder={`1 a ${maxAvailable}`}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#121a29] border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setQuantityInput(String(maxAvailable))}
                    className="px-3 h-10 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 transition-colors shrink-0"
                  >
                    Máximo ({maxAvailable})
                  </button>
                </div>
              </div>

              {parsedQuantity > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-blue-900 dark:text-blue-200">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Confirmação de Reserva Atômica:</span>
                  </div>
                  <p className="text-xs text-blue-800 dark:text-blue-300 pl-6">
                    <strong className="font-semibold">{parsedQuantity} peças</strong> ({calculatedArea} m²) serão reservadas para o pallet <strong className="font-mono font-bold">{palletCode}</strong>.
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-6">
                    O saldo disponível na obra passará de {maxAvailable} para {maxAvailable - parsedQuantity} pçs. O total físico na obra permanece inalterado.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
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
              disabled={isSubmitting || !selectedMaterialId || parsedQuantity <= 0 || parsedQuantity > maxAvailable}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reservando no Pallet...</span>
                </>
              ) : (
                <>
                  <span>Confirmar Reserva</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
