import React from 'react'
import { cn } from '../../lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive?: boolean
    label?: string
  }
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success'
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon,
  trend,
  variant = 'default',
  className,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'border-l-2 border-l-blue-600'
      case 'warning':
        return 'border-l-2 border-l-amber-500'
      case 'danger':
        return 'border-l-2 border-l-rose-600'
      case 'success':
        return 'border-l-2 border-l-emerald-600'
      default:
        return 'border-l-2 border-l-transparent'
    }
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 shadow-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-700',
        getVariantStyles(),
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {unit}
          </span>
        )}
      </div>

      {trend && (
        <div className="mt-1.5 flex items-center text-[11px]">
          <span
            className={cn(
              'font-semibold mr-1',
              trend.isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {trend.value}
          </span>
          {trend.label && (
            <span className="text-zinc-400 dark:text-zinc-500">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  )
}
