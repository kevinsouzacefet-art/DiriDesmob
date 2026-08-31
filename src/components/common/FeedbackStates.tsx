import React from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

export const EmptyState: React.FC<{
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode | React.ComponentType<any>
  className?: string
}> = ({
  title = 'Nenhum registro encontrado',
  description = 'Não há dados cadastrados no momento ou os filtros aplicados não retornaram resultados.',
  actionLabel,
  onAction,
  icon,
  className,
}) => {
  const renderIcon = () => {
    if (!icon) return <Inbox className="w-6 h-6" />
    if (React.isValidElement(icon)) return icon
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('$$typeof' in icon || 'render' in icon))
    ) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>
      return <IconComponent className="w-6 h-6" />
    }
    return icon as React.ReactNode
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg min-h-[220px]',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-3">
        {renderIcon()}
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Carregando dados do servidor...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  )
}

export const ErrorState: React.FC<{
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}> = ({
  title = 'Erro ao carregar dados',
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center bg-rose-500/5 border border-rose-500/20 rounded-lg',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-2">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">{title}</h4>
      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar Novamente
        </button>
      )}
    </div>
  )
}
