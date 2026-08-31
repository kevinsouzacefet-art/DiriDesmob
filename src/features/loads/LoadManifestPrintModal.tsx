import React from 'react'
import { LoadWithRelations } from '../../types'
import { Printer, X, Truck, Package, MapPin, Calendar, User, FileText } from 'lucide-react'

interface LoadManifestPrintModalProps {
  load: LoadWithRelations
  isOpen: boolean
  onClose: () => void
}

export const LoadManifestPrintModal: React.FC<LoadManifestPrintModalProps> = ({
  load,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const formattedDate = new Date().toLocaleString('pt-BR')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Romaneio de Carga & Transporte — {load.code}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir Romaneio
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 space-y-6 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 print:text-black print:bg-white print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white print:text-black">
                  DIRIDESMOB
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono print:border print:border-zinc-400">
                  SISTEMA DE LOGÍSTICA
                </span>
              </div>
              <h1 className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white print:text-black">
                ROMANEIO DE TRANSPORTE E MANIFESTO DE CARGA
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 print:text-zinc-600">
                Documento de controle de transferência e segregação de estoque em trânsito
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 print:text-black">
                {load.code}
              </div>
              <div className="text-xs text-zinc-500 print:text-zinc-600">
                Status: <span className="font-semibold uppercase">{load.status}</span>
              </div>
              <div className="text-xs text-zinc-500 print:text-zinc-600">
                Emissão: {formattedDate}
              </div>
            </div>
          </div>

          {/* Locations and Transport Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Origin & Destination */}
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 print:bg-transparent print:border-zinc-300 space-y-3">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-1">
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                Origem e Destino
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500 font-medium">ORIGEM:</span>
                  <div className="font-bold text-sm">
                    {load.origin_location?.name || 'Localização de Origem'} ({load.origin_location?.code})
                  </div>
                  <div className="text-zinc-500 text-[11px]">
                    Tipo: {load.origin_location?.type} | {load.origin_location?.city || ''} - {load.origin_location?.state || ''}
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-zinc-500 font-medium">DESTINO:</span>
                  <div className="font-bold text-sm">
                    {load.destination_location?.name || 'Localização de Destino'} ({load.destination_location?.code})
                  </div>
                  <div className="text-zinc-500 text-[11px]">
                    Tipo: {load.destination_location?.type} | {load.destination_location?.city || ''} - {load.destination_location?.state || ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Transport & Dates */}
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 print:bg-transparent print:border-zinc-300 space-y-3">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b pb-1">
                <Truck className="w-3.5 h-3.5 text-zinc-500" />
                Dados do Transporte
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-zinc-500">Placa do Veículo:</span>
                  <div className="font-bold font-mono text-sm">
                    {load.vehicle_plate || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Motorista:</span>
                  <div className="font-semibold">{load.driver_name || '—'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Transportadora:</span>
                  <div className="font-semibold">{load.carrier_name || '—'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Data de Saída:</span>
                  <div className="font-semibold">
                    {load.departure_date ? new Date(load.departure_date).toLocaleDateString('pt-BR') : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Previsão Chegada:</span>
                  <div className="font-semibold">
                    {load.expected_arrival_date ? new Date(load.expected_arrival_date).toLocaleDateString('pt-BR') : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Expedido em:</span>
                  <div className="font-semibold">
                    {load.sent_at ? new Date(load.sent_at).toLocaleString('pt-BR') : 'Pendente'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-center print:bg-zinc-100 print:border print:border-zinc-300">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                Total de Pallets
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white print:text-black">
                {load.pallets_count || load.pallets?.length || 0}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                Total de Peças
              </div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 print:text-black">
                {load.total_pieces || 0} un
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                Área Total
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white print:text-black">
                {load.total_area_m2?.toFixed(2) || '0.00'} m²
              </div>
            </div>
          </div>

          {/* Pallets List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              1. Relação de Pallets na Carga
            </h4>
            <table className="w-full text-left text-xs border border-zinc-200 dark:border-zinc-800 print:border-zinc-400">
              <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-semibold print:bg-zinc-200">
                <tr>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 w-12 text-center">#</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700">Código Pallet</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700">Status Pallet</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700">Itens / Conteúdo</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-right">Qtd Peças</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-right">Área (m²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 print:divide-zinc-300">
                {(load.pallets || []).map((p, idx) => (
                  <tr key={p.id}>
                    <td className="p-2 text-center text-zinc-500 font-mono">{idx + 1}</td>
                    <td className="p-2 font-mono font-bold">{p.code}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {p.items.map((it) => `${it.material.code} (${it.quantity})`).join(', ')}
                    </td>
                    <td className="p-2 text-right font-medium">{p.total_pieces}</td>
                    <td className="p-2 text-right font-medium">{p.total_area_m2.toFixed(2)}</td>
                  </tr>
                ))}
                {(!load.pallets || load.pallets.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-zinc-400">
                      Nenhum pallet vinculado a esta carga.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Consolidated Materials Breakdown */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              2. Consolidação Geral de Materiais Embarcados
            </h4>
            <table className="w-full text-left text-xs border border-zinc-200 dark:border-zinc-800 print:border-zinc-400">
              <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-semibold print:bg-zinc-200">
                <tr>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 w-24">Código</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700">Descrição do Material</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-right">Área Unit (m²)</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-right">Qtd Total (un)</th>
                  <th className="p-2 border-b border-zinc-200 dark:border-zinc-700 text-right">Área Total (m²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 print:divide-zinc-300">
                {(load.consolidated_materials || []).map((m) => (
                  <tr key={m.material_id}>
                    <td className="p-2 font-mono font-bold text-zinc-900 dark:text-zinc-100">{m.material_code}</td>
                    <td className="p-2 text-zinc-700 dark:text-zinc-300">{m.material_name}</td>
                    <td className="p-2 text-right font-mono text-zinc-500">{m.unit_area_m2.toFixed(4)}</td>
                    <td className="p-2 text-right font-bold text-zinc-900 dark:text-zinc-100">{m.total_pieces}</td>
                    <td className="p-2 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {m.total_area_m2.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(!load.consolidated_materials || load.consolidated_materials.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-zinc-400">
                      Nenhum material embarcado.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-zinc-50 dark:bg-zinc-800 font-bold print:bg-zinc-100">
                <tr>
                  <td colSpan={3} className="p-2 text-right">TOTAL GERAL:</td>
                  <td className="p-2 text-right text-indigo-600 dark:text-indigo-400 print:text-black">{load.total_pieces || 0} un</td>
                  <td className="p-2 text-right text-indigo-600 dark:text-indigo-400 print:text-black">{load.total_area_m2?.toFixed(2) || '0.00'} m²</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Observations */}
          {load.notes && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded border border-zinc-200 dark:border-zinc-800 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Observações: </span>
              <span className="text-zinc-600 dark:text-zinc-400">{load.notes}</span>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-10 grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-zinc-400 pb-1 mb-1 font-semibold text-zinc-800 dark:text-zinc-200">
                _______________________________
              </div>
              <div className="font-bold">Conferente / Expedição (Origem)</div>
              <div className="text-[10px] text-zinc-500">Data: ____/____/________</div>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-1 mb-1 font-semibold text-zinc-800 dark:text-zinc-200">
                _______________________________
              </div>
              <div className="font-bold">Motorista / Transportador</div>
              <div className="text-[10px] text-zinc-500">Data: ____/____/________</div>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-1 mb-1 font-semibold text-zinc-800 dark:text-zinc-200">
                _______________________________
              </div>
              <div className="font-bold">Conferente / Recebimento (Destino)</div>
              <div className="text-[10px] text-zinc-500">Data: ____/____/________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
