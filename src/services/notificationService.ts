import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Notification } from '../types'

const fallbackNotifications: Notification[] = [
  {
    id: 'n1111111-1111-1111-1111-111111111111',
    user_id: null,
    target_role: null,
    target_location_id: 'b2222222-2222-2222-2222-222222222221',
    title: 'Nova Desmobilização Autorizada',
    message: 'A Obra Residencial Park Towers iniciou o processo de paletização dos painéis 2400x600.',
    event_type: 'DESMOBILIZACAO_INICIADA',
    is_read: false,
    read_at: null,
    metadata: null,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  },
  {
    id: 'n2222222-2222-2222-2222-222222222222',
    user_id: null,
    target_role: 'ADMINISTRADOR',
    target_location_id: null,
    title: 'Conferência Concluída com Divergência',
    message: 'Carga CARG-2025-014 recebida na Formax com apontamento de 2 peças faltantes.',
    event_type: 'DIVERGENCIA_APONTADA',
    is_read: false,
    read_at: null,
    metadata: null,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
  },
  {
    id: 'n3333333-3333-3333-3333-333333333333',
    user_id: null,
    target_role: null,
    target_location_id: 'a1111111-1111-1111-1111-111111111111',
    title: 'Carga em Trânsito',
    message: 'Motorista José Carlos iniciou o trajeto da carga CARG-2025-015 para o Galpão Central.',
    event_type: 'CARGA_DESPACHADA',
    is_read: true,
    read_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    metadata: null,
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
]

export const notificationService = {
  async listNotifications(): Promise<Notification[]> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_notifs')
      return stored ? JSON.parse(stored) : fallbackNotifications
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error)
      return []
    }

    return (data || []) as Notification[]
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('diridesmob_custom_notifs')
      const list: Notification[] = stored ? JSON.parse(stored) : [...fallbackNotifications]
      const index = list.findIndex(n => n.id === notificationId)
      if (index !== -1) {
        list[index].is_read = true
        list[index].read_at = new Date().toISOString()
        localStorage.setItem('diridesmob_custom_notifs', JSON.stringify(list))
      }
      return
    }

    // Call safe RPC as required by security patch
    const { error: rpcError } = await supabase.rpc('fn_mark_notification_read' as any, {
      p_notification_id: notificationId,
    })

    if (rpcError) {
      console.warn('RPC mark read error, attempting standard update fallback:', rpcError)
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
    }
  },
}
