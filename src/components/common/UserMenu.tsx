import React, { useState, useRef, useEffect } from 'react'
import { LogOut, User, Shield, ChevronDown } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { getRoleLabel } from '../../lib/utils'

export const UserMenu: React.FC = () => {
  const { profile, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!profile) return null

  const initials = profile.full_name
    ? profile.full_name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left"
        aria-label="Menu do usuário"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
          {initials}
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
            {profile.full_name}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
            {getRoleLabel(profile.system_role)}
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{profile.full_name}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{profile.email}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20">
              <Shield className="w-3 h-3" />
              {getRoleLabel(profile.system_role)}
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                signOut()
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
