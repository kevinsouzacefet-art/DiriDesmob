import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AuditLog } from '../types'

export interface AuditLogFilter {
  entityTable?: string
  action?: string
  userId?: string
  startDate?: string
  endDate?: string
}

export const auditService = {
  async listLogs(filters?: AuditLogFilter): Promise<(AuditLog & { user?: any })[]> {
    if (!isSupabaseConfigured) return []

    let query = supabase
      .from('audit_logs')
      .select('*, user:profiles!user_id(id, full_name, email, system_role)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filters?.entityTable) {
      query = query.eq('entity_table', filters.entityTable)
    }
    if (filters?.action) {
      query = query.eq('action', filters.action)
    }
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async logAction(action: string, entityTable: string, entityId?: string, oldData?: any, newData?: any) {
    if (!isSupabaseConfigured) return

    try {
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        user_id: userData?.user?.id || null,
        action,
        entity_table: entityTable,
        entity_id: entityId || null,
        old_data: oldData || null,
        new_data: newData || null,
      })
    } catch (err) {
      console.warn('Audit logging failed non-blockingly:', err)
    }
  },
}
