import React from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { Construction, ArrowRight, ShieldCheck } from 'lucide-react'

interface ModulePlaceholderProps {
  title: string
  subtitle: string
  stepDescription: string
  onBackToDashboard: () => void
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  subtitle,
  stepDescription,
  onBackToDashboard,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-800">
          <Construction className="w-7 h-7" />
        </div>

        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Fundação de Dados e Backend Prontos
        </h2>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed max-w-lg mx-auto">
          {stepDescription}
        </p>

        <div className="mt-5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-left text-xs max-w-md mx-auto space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Estrutura de Segurança Concluída:</span>
          </div>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 list-disc list-inside space-y-0.5">
            <li>Tabelas e foreign keys criadas e indexadas</li>
            <li>Row Level Security (RLS) sem <code>USING (TRUE)</code></li>
            <li>Ledger de movimentações e segregação por carga configurados</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <span>Voltar ao Dashboard Executivo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
