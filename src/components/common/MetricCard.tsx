import React from 'react'
import { cn } from '../../lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  secondaryValue?: string | number
  unit?: string
  icon?: React.ReactNode | React.ComponentType<any>
  trend?: {
    value: string
    isPositive?: boolean
    label?: string
  }
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success'
  color?: 'blue' | 'emerald' | 'indigo' | 'amber' | 'violet' | 'rose' | 'slate' | 'cyan'
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  secondaryValue,
  unit,
  icon,
  trend,
  variant = 'default',
  color,
  className,
}) => {
  const getVariantStyles深入 = () => {
    if (color) {
      switch (color) {
        case 'blue':
          return 'border-l-2 border-l-blue-500'
        case 'emerald':
          return 'border-l-2 border-l-emerald-500'
        case 'indigo':
          return 'border-l-2 border-l-indigo-500'
        case 'amber':
          return 'border-l-2 border-l-amber-500'
        case 'violet':
          return 'border-l-2 border-l-violet-500'
        case 'rose':
          return 'border-l-2 border-l-rose-500'
        case 'cyan':
          return 'border-l-2 border-l-cyan-500'
        default:
          return 'border-l-2 border-l-zinc-400'
      }
    }

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

  const renderIcon = () => {
    if (!icon) return null
    if (React.isValidElement(icon)) return icon
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('$$typeof' in icon || 'render' in icon))
    ) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>
      return <IconComponent className="w-4 h-4" />
    }
    return icon as React.ReactNode
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 shadow-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-700',
        getVariantStyles深入(),
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider line-clamp-1">
          {label}
        </span>
        {icon && (
          <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
            {renderIcon()}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
        <span className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {unit}
          </span>
        )}
      </div>

      {secondaryValue !== undefined && secondaryValue !== null && (
        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
          {secondaryValue}
        </div>
      )}

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

