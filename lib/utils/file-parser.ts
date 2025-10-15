import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataRow } from '@/lib/store'

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

export const parseExcel = (file: File): Promise<DataRow[]> => {
  console.log('[FILE-PARSER] parseExcel called for file:', file.name)
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          console.log('[FILE-PARSER] FileReader onload triggered')
          const data = e.target?.result
          if (!data) {
            throw new Error('No data read from file')
          }

          console.log('[FILE-PARSER] Reading Excel workbook...')
          const workbook = XLSX.read(data, { type: 'binary' })
          console.log('[FILE-PARSER] Workbook read successfully, sheets:', workbook.SheetNames)

          // Get the first worksheet
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]

          // Convert to JSON
          console.log('[FILE-PARSER] Converting sheet to JSON...')
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            dateNF: 'yyyy-mm-dd'
          })

          console.log('[FILE-PARSER] parseExcel completed, rows:', jsonData.length)
          resolve(jsonData as DataRow[])
        } catch (error) {
          console.error('[FILE-PARSER] parseExcel processing error:', error)
          reject(error)
        }
      }

      reader.onerror = (error) => {
        console.error('[FILE-PARSER] FileReader error:', error)
        reject(error)
      }

      console.log('[FILE-PARSER] Starting to read file as binary string...')
      reader.readAsBinaryString(file)
    } catch (error) {
      console.error('[FILE-PARSER] parseExcel synchronous error:', error)
      reject(error)
    }
  })
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