import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key-here'
)

// Fallback mock-safe initialization if env vars are not set during initial bootstrap
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co'
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})

/**
 * Traduz erros do Postgres / Supabase para mensagens amigáveis em português
 */
export function formatSupabaseError(error: any): string {
  if (!error) return 'Ocorreu um erro desconhecido.'
  
  const msg = error.message || error.details || String(error)

  if (msg.includes('23505') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    return 'Já existe um registro cadastrado com este código ou identificador único.'
  }
  if (msg.includes('23503') || msg.includes('foreign key constraint')) {
    return 'Não é possível concluir a operação pois o registro está vinculado a outros itens do sistema.'
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Acesso negado: suas credenciais de acesso não possuem permissão para esta operação nesta localização.'
  }
  if (msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.'
  }
  if (msg.includes('Email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique a caixa de entrada do seu e-mail.'
  }
  if (msg.includes('User not found')) {
    return 'Usuário não encontrado no sistema.'
  }
  if (msg.includes('Password should be')) {
    return 'A senha não atende aos requisitos mínimos de segurança.'
  }

  return msg
}
