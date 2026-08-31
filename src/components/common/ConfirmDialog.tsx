import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  const getButtonStyles = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white'
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white'
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3 leading-relaxed">{message}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors shadow-xs cursor-pointer ${getButtonStyles()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
