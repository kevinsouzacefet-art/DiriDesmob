import React from 'react'
import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status?: string | boolean | null
  type?: 'work' | 'load' | 'pallet' | 'boolean' | 'role' | 'location'
  customLabel?: string
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'work',
  customLabel,
  className,
}) => {
  if (status === null || status === undefined) return null

  // Boolean Active/Inactive
  if (typeof status === 'boolean' || type === 'boolean') {
    const isActive = Boolean(status)
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider',
          isActive
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20',
          className
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', isActive ? 'bg-emerald-500' : 'bg-zinc-400')} />
        {customLabel || (isActive ? 'Ativo' : 'Inativo')}
      </span>
    )
  }

  const str = String(status)

  // Work Statuses
  if (str === 'EM_ANDAMENTO') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
        {customLabel || 'Em Andamento'}
      </span>
    )
  }
  if (str === 'DESMOBILIZACAO_INICIADA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
        {customLabel || 'Desmob. Iniciada'}
      </span>
    )
  }
  if (str === 'CONCLUIDA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {customLabel || 'Concluída'}
      </span>
    )
  }
  // Demobilization Statuses
  if (str === 'DISPONIVEL') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5" />
        {customLabel || 'Disponível'}
      </span>
    )
  }
  if (str === 'EM_DESMOBILIZACAO') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
        {customLabel || 'Em desmobilização'}
      </span>
    )
  }
  if (str === 'PARCIALMENTE_DESMOBILIZADA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5" />
        {customLabel || 'Parcialmente desmobilizada'}
      </span>
    )
  }
  if (str === 'DESMOBILIZADA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {customLabel || 'Desmobilizada'}
      </span>
    )
  }

  // Pallet Statuses
  if (str === 'EM_MONTAGEM') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
        {customLabel || 'Em Montagem'}
      </span>
    )
  }
  if (str === 'PRONTO') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {customLabel || 'Pronto'}
      </span>
    )
  }
  if (str === 'RESERVADO') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
        {customLabel || 'Reservado'}
      </span>
    )
  }
  if (str === 'DESMONTADO' || str === 'CANCELADO' || str === 'REJEITADA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
        {customLabel || (str === 'DESMONTADO' ? 'Desmontado' : str === 'CANCELADO' ? 'Cancelado' : str)}
      </span>
    )
  }

  // Location Types
  if (str === 'OBRA') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20', className)}>
        Obra
      </span>
    )
  }
  if (str === 'FORNECEDOR') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20', className)}>
        Fornecedor
      </span>
    )
  }
  if (str === 'GALPAO') {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20', className)}>
        Galpão
      </span>
    )
  }

  // Generic Default
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20', className)}>
      {customLabel || str}
    </span>
  )
}
