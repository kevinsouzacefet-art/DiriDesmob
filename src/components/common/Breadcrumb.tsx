import React from 'react'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  onNavigate?: (path: string) => void
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <button
        onClick={() => onNavigate && onNavigate('/app/dashboard')}
        className="flex items-center hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
      >
        <Home className="w-3.5 h-3.5" />
      </button>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3 h-3 text-zinc-400" />
            {isLast || !item.path ? (
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
            ) : (
              <button
                onClick={() => onNavigate && item.path && onNavigate(item.path)}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
