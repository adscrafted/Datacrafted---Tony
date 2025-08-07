import { parseCSV, parseExcel } from '@/lib/utils/file-parser'

// Mock XLSX
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}))

import * as XLSX from 'xlsx'

describe('File Parser Utilities', () => {
  describe('parseCSV', () => {
    it('parses valid CSV content', () => {
      const csvContent = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles'
      const result = parseCSV(csvContent)
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0]).toEqual({
        name: 'John',
        age: '30',
        city: 'New York'
      })
    })

    it('handles CSV with different delimiters', () => {
      const csvContent = 'name;age;city\nJohn;30;New York\nJane;25;Los Angeles'
      const result = parseCSV(csvContent, ';')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('handles empty CSV content', () => {
      const result = parseCSV('')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No data')
    })

    it('handles CSV with headers only', () => {
      const csvContent = 'name,age,city'
      const result = parseCSV(csvContent)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No data')
    })

    it('handles malformed CSV', () => {
      const csvContent = 'name,age,city\nJohn,30\nJane,25,Los Angeles,Extra'
      const result = parseCSV(csvContent)
      
      // Should still parse successfully but with missing/extra fields
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('handles CSV with quotes and commas', () => {
      const csvContent = 'name,description\n"John","A person, who works"\n"Jane","Another person"'
      const result = parseCSV(csvContent)
      
      expect(result.success).toBe(true)
      expect(result.data?.[0]).toEqual({
        name: 'John',
        description: 'A person, who works'
      })
    })

    it('provides schema information', () => {
      const csvContent = 'name,age,salary,active\nJohn,30,50000,true\nJane,25,60000,false'
      const result = parseCSV(csvContent)
      
      expect(result.success).toBe(true)
      expect(result.schema).toBeDefined()
      expect(result.schema?.columns).toHaveLength(4)
      
      const nameColumn = result.schema?.columns.find(col => col.name === 'name')
      expect(nameColumn?.type).toBe('string')
      
      const ageColumn = result.schema?.columns.find(col => col.name === 'age')
      expect(ageColumn?.type).toBe('number')
    })
  })

  describe('parseExcel', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('parses valid Excel buffer', () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      }
      
      const mockData = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' }
      ]
      
      ;(XLSX.read as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mockData)
      
      const buffer = Buffer.from('fake excel content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
      expect(XLSX.read).toHaveBeenCalledWith(buffer, { type: 'buffer' })
    })

    it('handles Excel with multiple sheets (uses first sheet)', () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: {
          Sheet1: {},
          Sheet2: {}
        }
      }
      
      const mockData = [{ name: 'John', age: 30 }]
      
      ;(XLSX.read as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mockData)
      
      const buffer = Buffer.from('fake excel content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(true)
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalledWith(mockWorkbook.Sheets.Sheet1)
    })

    it('handles empty Excel file', () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      }
      
      ;(XLSX.read as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([])
      
      const buffer = Buffer.from('fake excel content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No data')
    })

    it('handles Excel parsing errors', () => {
      ;(XLSX.read as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid Excel file')
      })
      
      const buffer = Buffer.from('invalid content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid Excel file')
    })

    it('handles Excel file with no sheets', () => {
      const mockWorkbook = {
        SheetNames: [],
        Sheets: {}
      }
      
      ;(XLSX.read as jest.Mock).mockReturnValue(mockWorkbook)
      
      const buffer = Buffer.from('fake excel content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No sheets')
    })

    it('provides schema information for Excel data', () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      }
      
      const mockData = [
        { name: 'John', age: 30, salary: 50000, active: true },
        { name: 'Jane', age: 25, salary: 60000, active: false }
      ]
      
      ;(XLSX.read as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(mockData)
      
      const buffer = Buffer.from('fake excel content')
      const result = parseExcel(buffer)
      
      expect(result.success).toBe(true)
      expect(result.schema).toBeDefined()
      expect(result.schema?.columns).toHaveLength(4)
      
      const nameColumn = result.schema?.columns.find(col => col.name === 'name')
      expect(nameColumn?.type).toBe('string')
      
      const ageColumn = result.schema?.columns.find(col => col.name === 'age')
      expect(ageColumn?.type).toBe('number')
      
      const activeColumn = result.schema?.columns.find(col => col.name === 'active')
      expect(activeColumn?.type).toBe('boolean')
    })
  })
})