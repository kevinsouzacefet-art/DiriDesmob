import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { DataTable, Column } from '../../components/common/DataTable'
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates'
import { auditService, AuditLogFilter } from '../../services/auditService'
import { AuditLog } from '../../types'
import { formatDateTime } from '../../lib/utils'
import { exportToExcel } from '../../lib/exportExcel'
import { generatePdfReport } from '../../lib/exportPdf'
import {
  ShieldCheck,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
  Calendar,
  Lock,
} from 'lucide-react'

interface AuditPageProps {
  onNavigate?: (path: string) => void
}

export const AuditPage: React.FC<AuditPageProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<(AuditLog & { user?: any })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedTable, setSelectedTable] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await auditService.listLogs({
        entityTable: selectedTable || undefined,
        action: selectedAction || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setLogs(data)
    } catch (err: any) {
      console.error('Error loading audit logs:', err)
      setError('Não foi possível carregar o log de auditoria do sistema.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedTable, selectedAction, startDate, endDate])

  const handleExportExcel = () => {
    exportToExcel(
      logs,
      [
        { header: 'Data/Hora', key: l => formatDateTime(l.created_at) },
        { header: 'Usuário', key: l => (l as any).user?.full_name || 'Sistema / Anon' },
        { header: 'Email', key: l => (l as any).user?.email || '-' },
        { header: 'Perfil', key: l => (l as any).user?.system_role || '-' },
        { header: 'Ação', key: 'action' },
        { header: 'Tabela / Entidade', key: 'entity_table' },
        { header: 'ID da Entidade', key: (l: any) => l.entity_id || '-' },
      ],
      `auditoria_sistema_${Date.now()}`
    )
  }

  const handleExportPdf = () => {
    generatePdfReport(
      {
        title: 'Trilha de Auditoria do Sistema DIRIDESMOB',
        subtitle: 'Registro imutável de eventos e ações de usuários',
      },
      [
        { header: 'Data/Hora', dataKey: 'timestamp' },
        { header: 'Usuário', dataKey: 'user' },
        { header: 'Ação', dataKey: 'action' },
        { header: 'Tabela', dataKey: 'table' },
        { header: 'ID Registro', dataKey: 'entityId' },
      ],
      logs.map(l => ({
        timestamp: formatDateTime(l.created_at),
        user: `${(l as any).user?.full_name || 'Sistema'} (${(l as any).user?.system_role || 'Auto'})`,
        action: l.action,
        table: l.entity_table,
        entityId: l.entity_id || '-',
      }))
    )
  }

  const columns: Column<AuditLog & { user?: any }>[] = [
    {
      header: 'Data / Hora',
      accessor: l => (
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {formatDateTime(l.created_at)}
        </span>
      ),
    },
    {
      header: 'Usuário Responsável',
      accessor: l => (
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {l.user?.full_name || 'Ação do Sistema'}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            {l.user?.email || '-'} {l.user?.system_role && `• ${l.user.system_role}`}
          </div>
        </div>
      ),
    },
    {
      header: 'Ação Realizada',
      accessor: l => {
        const isDelete = l.action.includes('DELETE') || l.action.includes('EXCLUIR')
        const isInsert = l.action.includes('INSERT') || l.action.includes('CRIAR')
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold ${
              isDelete
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                : isInsert
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
            }`}
          >
            {l.action}
          </span>
        )
      },
    },
    {
      header: 'Entidade Afetada',
      accessor: l => (
        <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          {l.entity_table}
        </span>
      ),
    },
    {
      header: 'ID da Entidade',
      accessor: l => (
        <span className="font-mono text-xs text-zinc-500 truncate max-w-[120px] inline-block">
          {l.entity_id || '—'}
        </span>
      ),
    },
    {
      header: 'Detalhes',
      align: 'center',
      accessor: l => (
        <button
          onClick={() => setSelectedLog(l)}
          className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
          title="Ver Payload JSON"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trilha de Auditoria & Segurança"
        subtitle="Registro imutável de transações, ações de usuários, alterações de saldo e decisões operacionais"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>
        }
      />

      {/* Security Banner */}
      <div className="p-3 bg-zinc-900 text-zinc-100 rounded-lg flex items-center justify-between text-xs border border-zinc-800 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Armazenamento Imutável:</strong> Os registros desta trilha são somente de inserção (append-only), protegidos contra exclusão ou alteração por políticas de segurança RLS.
          </span>
        </div>
        <span className="font-mono text-zinc-400 text-[11px] shrink-0">
          {logs.length} eventos carregados
        </span>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>Filtros de Auditoria:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedTable}
              onChange={e => setSelectedTable(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            >
              <option value="">Todas as Entidades</option>
              <option value="stock_movements">stock_movements</option>
              <option value="loads">loads</option>
              <option value="load_conferences">load_conferences</option>
              <option value="divergences">divergences</option>
              <option value="losses">losses</option>
              <option value="scrap_movement_requests">scrap_movement_requests</option>
              <option value="supplier_service_rates">supplier_service_rates</option>
              <option value="profiles">profiles</option>
            </select>

            <input
              type="text"
              placeholder="Ação (ex: INSERT, FINALIZAR)"
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            />

            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            />

            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs text-zinc-800 dark:text-zinc-200"
            />

            <button
              onClick={() => {
                setSelectedTable('')
                setSelectedAction('')
                setStartDate('')
                setEndDate('')
              }}
              className="px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Carregando trilha de auditoria..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          data={logs}
          columns={columns}
          keyExtractor={l => l.id}
          emptyTitle="Nenhum registro de auditoria encontrado."
        />
      )}

      {/* Detail JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full p-6 border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Detalhes do Evento de Auditoria
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div>
                <span className="text-zinc-500 font-medium">Ação:</span>
                <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Data / Hora:</span>
                <p className="font-mono text-zinc-800 dark:text-zinc-200">{formatDateTime(selectedLog.created_at)}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Entidade:</span>
                <p className="font-mono text-zinc-800 dark:text-zinc-200">{selectedLog.entity_table}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">ID da Entidade:</span>
                <p className="font-mono text-zinc-800 dark:text-zinc-200">{selectedLog.entity_id || '—'}</p>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 text-xs">
              {selectedLog.old_data && (
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Dados Anteriores (Old Data):
                  </span>
                  <pre className="bg-zinc-950 text-rose-300 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Novos Dados (New Data):
                  </span>
                  <pre className="bg-zinc-950 text-emerald-300 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
