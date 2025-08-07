import * as XLSX from 'xlsx'
import { DataRow } from '@/lib/store'

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

export const parseExcelAllSheets = (file: File): Promise<MultiSheetParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        const sheets: SheetData[] = []
        
        // Process each sheet
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName]
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            dateNF: 'yyyy-mm-dd'
          }) as DataRow[]
          
          // Only include sheets with data
          if (jsonData.length > 0) {
            sheets.push({
              name: sheetName,
              data: jsonData,
              rowCount: jsonData.length,
              columnCount: Object.keys(jsonData[0] || {}).length
            })
          }
        })
        
        resolve({
          sheets,
          fileInfo: {
            fileName: file.name,
            fileSize: file.size,
            totalSheets: sheets.length
          }
        })
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = (error) => {
      reject(error)
    }
    
    reader.readAsBinaryString(file)
  })
}