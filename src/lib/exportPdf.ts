import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateTime } from './utils'

export interface PdfReportOptions {
  title: string
  subtitle?: string
  author?: string
  filtersSummary?: string
  fileName?: string
  orientation?: 'portrait' | 'landscape'
}

export interface PdfTableColumn {
  header: string
  dataKey: string
}

export function generatePdfReport(
  options: PdfReportOptions,
  columns: PdfTableColumn[],
  rows: Record<string, any>[]
) {
  const doc = new jsPDF({
    orientation: options.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // Header Banner
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageWidth, 24, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('DIRIDESMOB — SISTEMA DE GESTÃO DE FÔRMAS E DESMOBILIZAÇÃO', 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text(options.title.toUpperCase(), 14, 18)

  // Document Metadata box
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  let currentY = 32

  if (options.subtitle) {
    doc.text(options.subtitle, 14, currentY)
    currentY += 5
  }

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())} | Responsável: ${options.author || 'Sistema DiriDesmob'}`, 14, currentY)
  currentY += 4

  if (options.filtersSummary) {
    doc.text(`Filtros Aplicados: ${options.filtersSummary}`, 14, currentY)
    currentY += 5
  }

  // Draw separator
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, currentY, pageWidth - 14, currentY)
  currentY += 4

  // Table
  autoTable(doc, {
    startY: currentY,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(col => row[col.dataKey] ?? '')),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer page numbers
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Página ${data.pageNumber} de ${pageCount} — DIRIDESMOB Relatório Oficial`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    },
  })

  const fileName = options.fileName || `${options.title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`
  doc.save(fileName)
}
