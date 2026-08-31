import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Layers,
  Boxes,
  Building2,
  FileDown,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import {
  BatchPreviewSummary,
  StagingParsedRow,
  MobilizationImportBatch,
} from '../../types'
import { mobilizationService } from '../../services/mobilizationService'

interface MobilizationImportPageProps {
  onBack: () => void
  onNavigateToStock: () => void
  onViewMobilization: (id: string) => void
}

type TabFilter = 'all' | 'valid' | 'errors'

export const MobilizationImportPage: React.FC<MobilizationImportPageProps> = ({
  onBack,
  onNavigateToStock,
  onViewMobilization,
}) => {
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Staged parsed data
  const [summary, setSummary] = useState<BatchPreviewSummary | null>(null)
  const [rows, setRows] = useState<StagingParsedRow[]>([])
  const [isDuplicateFile, setIsDuplicateFile] = useState(false)
  const [currentBatch, setCurrentBatch] = useState<MobilizationImportBatch | null>(null)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [committedResult, setCommittedResult] = useState<{
    mobilization_id: string
    mobilization_code: string
    total_pieces: number
    total_pallets: number
    total_area_m2: number
  } | null>(null)

  // Process File Selection
  const handleFileProcess = async (file: File) => {
    if (!file) return

    const validExtensions = ['.xlsx', '.xls', '.csv']
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()

    if (!validExtensions.includes(fileExt)) {
      setErrorMsg('Formato de arquivo inválido. Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV.')
      return
    }

    setSelectedFile(file)
    setErrorMsg(null)
    setIsValidating(true)
    setCommittedResult(null)

    try {
      const result = await mobilizationService.parseAndValidateExcel(file)
      setSummary(result.summary)
      setRows(result.rows)
      setIsDuplicateFile(result.isDuplicateFile)

      if (result.isDuplicateFile) {
        setErrorMsg('Este arquivo já foi importado e confirmado anteriormente no sistema.')
      }

      // Automatically create staging batch in background
      const storagePath = await mobilizationService.uploadFileToStorage(file, result.summary.fileHash)
      const batch = await mobilizationService.createStagingBatch(
        result.summary,
        result.rows,
        storagePath,
        result.rows[0]?.resolvedWorkId || null,
        profile?.id || null
      )
      setCurrentBatch(batch)
    } catch (err: any) {
      console.error('Erro na validação do Excel:', err)
      setErrorMsg(err.message || 'Falha ao processar o arquivo Excel.')
      setSummary(null)
      setRows([])
      setCurrentBatch(null)
    } finally {
      setIsValidating(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setSummary(null)
    setRows([])
    setCurrentBatch(null)
    setErrorMsg(null)
    setIsDuplicateFile(false)
    setCommittedResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCommit = async () => {
    if (!currentBatch) return
    setIsCommitting(true)
    setErrorMsg(null)

    try {
      const result = await mobilizationService.commitImport(currentBatch.id)
      setCommittedResult(result)
      setShowConfirmModal(false)
    } catch (err: any) {
      console.error('Erro no commit da mobilização:', err)
      setErrorMsg(err.message || 'Erro ao efetivar o lote de mobilização.')
      setShowConfirmModal(false)
    } finally {
      setIsCommitting(false)
    }
  }

  // Filtered rows for the preview table
  const displayedRows = rows.filter((r) => {
    if (activeTab === 'valid') return r.isValid
    if (activeTab === 'errors') return !r.isValid
    return true
  })

  return (
    <div className="space-y-6" id="mobilization-import-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Importação de Mobilização (Excel)
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Processamento em duas etapas (Staging & Validação → Prévia → Gravação no Estoque)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mobilizationService.downloadSampleTemplate()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            Baixar Modelo Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Success Commitment Banner */}
      {committedResult && (
        <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                Mobilização Confirmada com Sucesso!
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                A remessa foi gravada no ledger imutável e o estoque físico da obra foi atualizado atomicamente.
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono font-medium text-emerald-800 dark:text-emerald-300">
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                  Código: {committedResult.mobilization_code}
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                  Peças: {committedResult.total_pieces.toLocaleString('pt-BR')}
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                  Pallets: {committedResult.total_pallets}
                </span>
                <span className="bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                  Área: {Number(committedResult.total_area_m2).toFixed(2)} m²
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60">
            <button
              type="button"
              onClick={() => onViewMobilization(committedResult.mobilization_id)}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs"
            >
              Ver Detalhes da Mobilização
            </button>
            <button
              type="button"
              onClick={onNavigateToStock}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded-lg transition"
            >
              Consultar Estoque em Obra
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition ml-auto"
            >
              Importar Outro Arquivo
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMsg && !committedResult && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Atenção na Validação do Arquivo</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Upload Zone (Visible when no file selected or want to change) */}
      {!summary && !committedResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121824] hover:border-zinc-400 dark:hover:border-zinc-600'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0])
              }
            }}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="excel-file-input"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              {isValidating ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isValidating ? 'Validando linhas da planilha...' : 'Arraste sua planilha de mobilização aqui'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Suporte para arquivos Excel (.xlsx, .xls) e CSV. As colunas obrigatórias são: Obra, Origem, Destino, Pallet, Material, Quantidade.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isValidating}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
              >
                <Upload className="w-4 h-4" />
                {isValidating ? 'Processando...' : 'Selecionar Arquivo do Computador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation & Preview Screen */}
      {summary && !committedResult && (
        <div className="space-y-6">
          {/* File & Batch Header Card */}
          <div className="p-4 sm:p-5 bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {summary.fileName}
                    </h3>
                    {summary.invalidRows === 0 && !isDuplicateFile ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pronto para Gravação
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                        <XCircle className="w-3.5 h-3.5" />
                        {summary.invalidRows > 0
                          ? `${summary.invalidRows} Linha(s) com Erro`
                          : 'Arquivo Duplicado'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    SHA-256: {summary.fileHash.slice(0, 16)}...{summary.fileHash.slice(-8)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {summary.invalidRows > 0 && (
                  <button
                    type="button"
                    onClick={() => mobilizationService.exportErrorsReport(rows, summary.fileName)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition border border-rose-200 dark:border-rose-800/50 shadow-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar Relatório de Erros
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Trocar Arquivo
                </button>
              </div>
            </div>

            {/* Metric Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Obra Receptora</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                  {summary.workCode}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">{summary.workName}</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Total de Linhas</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {summary.totalRows}
                </p>
                <p className="text-[10px] text-zinc-400">registros lidos</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Linhas Válidas</span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {summary.validRows}
                </p>
                <p className="text-[10px] text-zinc-400">100% validadas</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Linhas com Erro</span>
                <p className={`text-sm font-bold mt-1 ${summary.invalidRows > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
                  {summary.invalidRows}
                </p>
                <p className="text-[10px] text-zinc-400">inconsistências</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Total de Peças</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {summary.totalPieces.toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] text-zinc-400">em {summary.totalPallets} pallet(s)</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                <span className="text-[11px] font-medium text-zinc-400 uppercase">Área Total Calculada</span>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {summary.totalAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²
                </p>
                <p className="text-[10px] text-zinc-400">via catálogo oficial</p>
              </div>
            </div>
          </div>

          {/* Staging Preview Table & Filter Tabs */}
          <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200 dark:border-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Todas ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'valid'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-200 dark:border-emerald-800/60'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Válidas ({summary.validRows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('errors')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'errors'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shadow-xs border border-rose-200 dark:border-rose-800/60'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Com Erros ({summary.invalidRows})
                </button>
              </div>

              <div className="text-xs text-zinc-400">
                Mostrando {displayedRows.length} de {rows.length} linhas
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-zinc-100/70 dark:bg-zinc-800/70 sticky top-0 z-10 text-zinc-500 dark:text-zinc-400 uppercase text-[11px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Linha</th>
                    <th className="py-2.5 px-3">Pallet</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3">Descrição Catálogo</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Área (m²)</th>
                    <th className="py-2.5 px-3">Origem</th>
                    <th className="py-2.5 px-3">Destino</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4">Inconsistência / Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {displayedRows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition ${
                        !r.isValid
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : r.isDuplicateWarning
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-zinc-400 font-medium">
                        #{r.rowNumber}
                      </td>

                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {r.rawPallet || '---'}
                      </td>

                      <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.rawMaterial || '---'}
                      </td>

                      <td className="py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                        {r.resolvedMaterial ? r.resolvedMaterial.name : <span className="text-zinc-400 italic">Não encontrado</span>}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {r.quantity ? r.quantity.toLocaleString('pt-BR') : r.rawQuantity || '---'}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {r.calculatedAreaM2 !== null && r.calculatedAreaM2 !== undefined
                          ? r.calculatedAreaM2.toFixed(2)
                          : '---'}
                      </td>

                      <td className="py-2.5 px-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {r.rawOrigin}
                      </td>

                      <td className="py-2.5 px-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {r.rawDestination}
                      </td>

                      <td className="py-2.5 px-3">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                            <Check className="w-3 h-3" />
                            Válida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3 h-3" />
                            Inválida
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs">
                        {r.validationErrors.length > 0 ? (
                          <div className="space-y-0.5">
                            {r.validationErrors.map((err, idx) => (
                              <p key={idx} className="text-rose-600 dark:text-rose-400 font-medium">
                                <span className="font-semibold">[{err.field}]:</span> {err.message}
                              </p>
                            ))}
                          </div>
                        ) : r.isDuplicateWarning ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Linha possivelmente duplicada no arquivo.
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Sem erros</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-850/80 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {summary.invalidRows > 0 ? (
                  <p className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    O lote não pode ser confirmado pois contém {summary.invalidRows} linha(s) com erro. Corrija o arquivo ou cadastre os materiais faltantes no catálogo.
                  </p>
                ) : isDuplicateFile ? (
                  <p className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    Este arquivo já foi importado anteriormente no sistema. O reprocessamento acidental está bloqueado.
                  </p>
                ) : (
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Todas as {summary.validRows} linhas foram validadas com sucesso. Pronto para gravar a mobilização e formar o estoque.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  id="btn-confirmar-mobilizacao"
                  disabled={summary.invalidRows > 0 || isDuplicateFile || isCommitting}
                  onClick={() => setShowConfirmModal(true)}
                  className={`inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition ${
                    summary.invalidRows > 0 || isDuplicateFile || isCommitting
                      ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando Estoque...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirmar e Gravar Mobilização
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121824] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <PackageCheckIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Confirmar Mobilização de Materiais?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Esta operação é atômica e definitiva. As seguintes etapas serão executadas:
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750 text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
              <div className="flex justify-between py-1 border-b border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-zinc-400">Obra Receptora:</span>
                <span className="font-bold">{summary.workCode} - {summary.workName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-zinc-400">Total de Peças:</span>
                <span className="font-bold">{summary.totalPieces.toLocaleString('pt-BR')} unidades</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-zinc-400">Pallets de Remessa:</span>
                <span className="font-bold">{summary.totalPallets} volumes</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Área Total:</span>
                <span className="font-bold">{summary.totalAreaM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²</span>
              </div>
            </div>

            <ul className="text-xs text-zinc-500 space-y-1.5 list-disc pl-4">
              <li>Registro histórico imutável na tabela <code className="text-zinc-700 dark:text-zinc-300 font-mono">stock_movements</code>.</li>
              <li>Atualização direta e projeção do estoque disponível na obra em <code className="text-zinc-700 dark:text-zinc-300 font-mono">stock_balances</code>.</li>
              <li>Geração da entidade de mobilização e mapeamento dos pallets recebidos.</li>
            </ul>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isCommitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-modal-gravar"
                disabled={isCommitting}
                onClick={handleCommit}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Sim, Confirmar e Gravar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PackageCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m16 16 2 2 4-4" />
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path d="m7.5 4.27 9 5.15" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" x2="12" y1="22" y2="12" />
    </svg>
  )
}
