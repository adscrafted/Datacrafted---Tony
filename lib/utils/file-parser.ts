import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataRow } from '@/lib/store'

export const parseCSV = (file: File): Promise<DataRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as DataRow[])
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

export const parseExcel = (file: File): Promise<DataRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          dateNF: 'yyyy-mm-dd'
        })
        
        resolve(jsonData as DataRow[])
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