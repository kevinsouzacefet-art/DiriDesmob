import React from 'react'
import { LayoutDashboard, Building2, Truck, Layers, Bell } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MobileBottomNavProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const items = [
    { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Obras', path: '/app/obras', icon: Building2 },
    { name: 'Fornecedores', path: '/app/fornecedores', icon: Truck },
    { name: 'Materiais', path: '/app/materiais', icon: Layers },
    { name: 'Alertas', path: '/app/notificacoes', icon: Bell },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {items.map(item => {
        const Icon = item.icon
        const isActive = currentPath === item.path
        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded text-[10px] font-medium transition-colors cursor-pointer min-w-[56px]',
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span>{item.name}</span>
          </button>
        )
      })}
    </nav>
  )
}
