import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-200 dark:border-zinc-800">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
