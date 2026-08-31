import * as XLSX from 'xlsx'

export interface ExcelColumn<T = any> {
  header: string
  key: keyof T | string | ((item: T) => any)
  width?: number
}

export function exportToExcel<T = any>(
  data: T[],
  columns: ExcelColumn<T>[],
  fileName: string,
  sheetName: string = 'Relatório'
) {
  // Format rows
  const rows = data.map(item => {
    const rowObj: Record<string, any> = {}
    columns.forEach(col => {
      if (typeof col.key === 'function') {
        rowObj[col.header] = col.key(item) ?? ''
      } else {
        rowObj[col.header] = (item as any)[col.key] ?? ''
      }
    })
    return rowObj
  })

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Configure column widths
  worksheet['!cols'] = columns.map(col => ({
    wch: col.width || Math.max(col.header.length + 4, 14),
  }))

  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Write file
  const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  XLSX.writeFile(workbook, fullFileName)
}
