import React, { useState } from 'react'
import { useAuth } from '../../providers/AuthProvider'
import { Key, Mail, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { signIn, isConfigured, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor, informe seu e-mail e senha de acesso.')
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await signIn(email, password)
    setIsLoading(false)
    if (!result.success) {
      setError(result.error || 'Falha na autenticação.')
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    const res = await resetPassword(resetEmail)
    if (res.success) {
      setResetMessage(res.message || 'Instruções enviadas para seu e-mail.')
    } else {
      setError(res.error || 'Falha ao solicitar recuperação.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d141f] p-4 text-zinc-100 antialiased selection:bg-blue-600 selection:text-white">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl p-6 sm:p-8 shadow-2xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-600/30 mb-3">
            DD
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">DiriDesmob</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Sistema Integrado de Desmobilização & Fôrmas Metálicas
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com.br"
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-800/80 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <button
                type="button"
                onClick={() => setIsResetOpen(true)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-800/80 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold tracking-wide transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Profiles for Fast Access and Testing */}
        <div className="mt-6 pt-5 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Acesso Rápido por Perfil (1 Clique)</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 font-mono">
              Senha: 123456
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('admin@diridesmob.com.br')
                setPassword('123456')
                signIn('admin@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-blue-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400 text-xs group-hover:text-blue-300">Administrador</span>
                <span className="text-[10px] text-zinc-500">Acesso Total</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">admin@diridesmob.com.br</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('analista@diridesmob.com.br')
                setPassword('123456')
                signIn('analista@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 text-xs group-hover:text-emerald-300">Analista</span>
                <span className="text-[10px] text-zinc-500">Somente Leitura</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">analista@diridesmob.com.br</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('supervisor@diridesmob.com.br')
                setPassword('123456')
                signIn('supervisor@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-amber-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 text-xs group-hover:text-amber-300">Sup. de Obra</span>
                <span className="text-[10px] text-zinc-500">Park Towers</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">supervisor@diridesmob.com.br</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('fornecedor@diridesmob.com.br')
                setPassword('123456')
                signIn('fornecedor@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-purple-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-400 text-xs group-hover:text-purple-300">Sup. Fornecedor</span>
                <span className="text-[10px] text-zinc-500">Formax</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">fornecedor@diridesmob.com.br</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('galpao.conferente@diridesmob.com.br')
                setPassword('123456')
                signIn('galpao.conferente@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-cyan-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 text-xs group-hover:text-cyan-300">Conf. Galpão</span>
                <span className="text-[10px] text-zinc-500">Galpão Central</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">galpao.conferente@diridesmob.com.br</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setEmail('obra.conferente@diridesmob.com.br')
                setPassword('123456')
                signIn('obra.conferente@diridesmob.com.br', '123456')
              }}
              className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/80 hover:border-indigo-500/50 rounded-lg text-left transition-all cursor-pointer group disabled:opacity-50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-400 text-xs group-hover:text-indigo-300">Conf. de Obra</span>
                <span className="text-[10px] text-zinc-500">Park Towers</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">obra.conferente@diridesmob.com.br</div>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 mt-3 text-center">
            Clique em qualquer um dos perfis acima para entrar instantaneamente no sistema.
          </p>
        </div>

        {/* Supabase Status Footer */}
        <div className="mt-5 text-center text-[10px] text-zinc-500">
          {isConfigured ? (
            <span className="text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Supabase Backend Conectado
            </span>
          ) : (
            <span className="text-zinc-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-blue-400" /> Ambiente Integrado / Modo Sandbox
            </span>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Recuperação de Senha</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Informe seu e-mail para receber as instruções de redefinição de acesso.
            </p>

            {resetMessage ? (
              <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-4">
                {resetMessage}
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="seu.email@empresa.com.br"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                  >
                    Enviar Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
