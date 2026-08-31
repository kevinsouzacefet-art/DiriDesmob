import React, { useState, useEffect, useRef } from 'react'
import { Bell, Check, Clock, AlertTriangle, Truck, Layers, Inbox } from 'lucide-react'
import { notificationService } from '../../services/notificationService'
import { Notification } from '../../types'
import { formatDateTime } from '../../lib/utils'

interface NotificationDropdownProps {
  onViewAll?: () => void
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onViewAll }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const data = await notificationService.listNotifications()
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await notificationService.markAsRead(id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'DIVERGENCIA_APONTADA':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
      case 'CARGA_DESPACHADA':
        return <Truck className="w-3.5 h-3.5 text-blue-500" />
      case 'DESMOBILIZACAO_INICIADA':
        return <Layers className="w-3.5 h-3.5 text-emerald-500" />
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) loadNotifications()
        }}
        className="relative p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
        title="Notificações do Sistema"
        aria-label="Abrir notificações"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  {unreadCount} novas
                </span>
              )}
            </div>
            {onViewAll && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  onViewAll()
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Ver todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoading && notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Inbox className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mx-auto mb-1.5" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhuma notificação recebida</p>
              </div>
            ) : (
              notifications.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className={`p-3 text-xs transition-colors ${
                    !item.is_read
                      ? 'bg-blue-50/40 dark:bg-blue-950/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                      {getEventIcon(item.event_type)}
                      <span>{item.title}</span>
                    </div>
                    {!item.is_read && (
                      <button
                        onClick={e => handleMarkAsRead(item.id, e)}
                        title="Marcar como lida"
                        className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{item.message}</p>
                  <span className="text-[10px] text-zinc-400 mt-1.5 block">
                    {formatDateTime(item.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
