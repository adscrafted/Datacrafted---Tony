import type { DataRow } from '@/lib/store'
import { parseExcelAllSheetsSecurely } from './secure-xlsx-parser'

export interface SheetData {
  name: string
  data: DataRow[]
  rowCount: number
  columnCount: number
}

export interface MultiSheetParseResult {
  sheets: SheetData[]
  fileInfo: {
    fileName: string
    fileSize: number
    totalSheets: number
  }
}

export const parseExcelAllSheets = async (file: File): Promise<MultiSheetParseResult> => {
  try {
    const sheetsData = await parseExcelAllSheetsSecurely<DataRow>(file, {
      dateFormat: 'yyyy-mm-dd',
      raw: false,
      includeEmptySheets: false
    })

    const sheets: SheetData[] = sheetsData.map(sheet => ({
      name: sheet.name,
      data: sheet.data,
      rowCount: sheet.data.length,
      columnCount: Object.keys(sheet.data[0] || {}).length
    }))

    return {
      sheets,
      fileInfo: {
        fileName: file.name,
        fileSize: file.size,
        totalSheets: sheets.length
      }
    }
  } catch (error) {
    throw error
  }
}