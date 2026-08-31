import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../providers/ThemeProvider'
import { cn } from '../../lib/utils'

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer',
        className
      )}
      title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
    </button>
  )
}
