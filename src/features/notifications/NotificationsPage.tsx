import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { notificationService } from '../../services/notificationService'
import { Notification } from '../../types'
import { formatDateTime } from '../../lib/utils'
import { Bell, Check, AlertTriangle, Truck, Layers, Clock } from 'lucide-react'

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await notificationService.listNotifications()
      setNotifications(data)
    } catch (err: any) {
      console.error('Error loading notifications:', err)
      setError('Não foi possível carregar as notificações.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'DIVERGENCIA_APONTADA':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'CARGA_DESPACHADA':
        return <Truck className="w-4 h-4 text-blue-500" />
      case 'DESMOBILIZACAO_INICIADA':
        return <Layers className="w-4 h-4 text-emerald-500" />
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  const columns: Column<Notification>[] = [
    {
      header: 'Tipo de Evento',
      accessor: n => (
        <div className="flex items-center gap-2">
          {getEventIcon(n.event_type)}
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{n.title}</span>
        </div>
      ),
    },
    {
      header: 'Mensagem',
      accessor: n => (
        <span className="text-zinc-700 dark:text-zinc-300 max-w-lg block leading-relaxed">
          {n.message}
        </span>
      ),
    },
    {
      header: 'Data / Hora',
      accessor: n => (
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {formatDateTime(n.created_at)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: n =>
        n.is_read ? (
          <span className="text-[11px] text-zinc-400">Lida</span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Nova
          </span>
        ),
    },
    {
      header: 'Ação',
      align: 'right',
      accessor: n =>
        !n.is_read ? (
          <button
            onClick={() => handleMarkAsRead(n.id)}
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Check className="w-3 h-3" />
            <span>Marcar como lida</span>
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader
        title="Central de Notificações"
        subtitle="Histórico de alertas e eventos operacionais transmitidos pelo sistema"
      />

      {isLoading ? (
        <LoadingState message="Carregando notificações..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadNotifications} />
      ) : (
        <DataTable
          columns={columns}
          data={notifications}
          keyExtractor={n => n.id}
          emptyTitle="Nenhuma notificação"
          emptyDescription="Você está em dia! Não há alertas operacionais pendentes."
        />
      )}
    </div>
  )
}
