import Papa from 'papaparse'
import type { DataRow } from '@/lib/store'
import { parseExcelSecurely } from './secure-xlsx-parser'

export const parseCSV = (file: File): Promise<DataRow[]> => {
  console.log('[FILE-PARSER] parseCSV called for file:', file.name)
  return new Promise((resolve, reject) => {
    try {
      console.log('[FILE-PARSER] Calling Papa.parse...')
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('[FILE-PARSER] Papa.parse completed', {
            rowCount: results.data.length,
            errors: results.errors?.length || 0,
            meta: results.meta
          })
          if (results.errors && results.errors.length > 0) {
            console.warn('[FILE-PARSER] Parse warnings:', results.errors)
          }
          resolve(results.data as DataRow[])
        },
        error: (error) => {
          console.error('[FILE-PARSER] Papa.parse error:', error)
          reject(error)
        }
      })
      console.log('[FILE-PARSER] Papa.parse initiated (async)')
    } catch (error) {
      console.error('[FILE-PARSER] parseCSV synchronous error:', error)
      reject(error)
    }
  })
}

export const parseExcel = async (file: File): Promise<DataRow[]> => {
  console.log('[FILE-PARSER] parseExcel called for file:', file.name)
  try {
    console.log('[FILE-PARSER] Using secure Excel parser...')
    const jsonData = await parseExcelSecurely<DataRow>(file, {
      sheetIndex: 0,
      dateFormat: 'yyyy-mm-dd',
      raw: false
    })
    console.log('[FILE-PARSER] parseExcel completed securely, rows:', jsonData.length)
    return jsonData
  } catch (error) {
    console.error('[FILE-PARSER] parseExcel error:', error)
    throw error
  }
}

export const parseFile = async (file: File): Promise<DataRow[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'csv':
      return parseCSV(file)
    case 'xlsx':
    case 'xls':
      return parseExcel(file)
    default:
      throw new Error('Unsupported file type. Please upload a CSV or Excel file.')
  }
}