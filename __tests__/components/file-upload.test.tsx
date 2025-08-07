import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileUpload from '@/components/upload/file-upload'

// Mock file reader
const mockFileReader = {
  readAsText: jest.fn(),
  result: 'mocked csv content',
  onload: null as any,
  onerror: null as any,
}

global.FileReader = jest.fn(() => mockFileReader) as any

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('FileUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        sessionId: 'test-session-id',
        analysis: { insights: [], summary: {} }
      })
    })
  })

  it('renders file upload component', () => {
    render(<FileUpload onAnalysisComplete={jest.fn()} />)
    
    expect(screen.getByText(/drag & drop your data files here/i)).toBeInTheDocument()
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument()
  })

  it('accepts CSV files', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['name,age\nJohn,30\nJane,25'], 'test.csv', {
      type: 'text/csv'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    expect(input.files).toHaveLength(1)
    expect(input.files?.[0]).toBe(file)
  })

  it('accepts Excel files', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['fake excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    expect(input.files).toHaveLength(1)
    expect(input.files?.[0]).toBe(file)
  })

  it('rejects invalid file types', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['invalid content'], 'test.txt', {
      type: 'text/plain'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument()
    })
  })

  it('shows file size limit error for large files', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    // Create a file larger than 50MB
    const largeContent = 'x'.repeat(50 * 1024 * 1024 + 1)
    const file = new File([largeContent], 'large.csv', {
      type: 'text/csv'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText(/file size exceeds/i)).toBeInTheDocument()
    })
  })

  it('handles drag and drop', async () => {
    const onAnalysisComplete = jest.fn()
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['name,age\nJohn,30'], 'test.csv', {
      type: 'text/csv'
    })
    
    const dropZone = screen.getByText(/drag & drop your data files here/i).closest('div')
    
    fireEvent.dragEnter(dropZone!)
    fireEvent.dragOver(dropZone!)
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument()
    })
  })

  it('processes file upload and calls analysis', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['name,age\nJohn,30\nJane,25'], 'test.csv', {
      type: 'text/csv'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    // Simulate FileReader onload
    setTimeout(() => {
      if (mockFileReader.onload) {
        mockFileReader.onload({} as any)
      }
    }, 100)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('test.csv')
      }))
    }, { timeout: 5000 })
  })

  it('shows loading state during analysis', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    // Mock a delayed response
    mockFetch.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, sessionId: 'test' })
        }), 1000)
      )
    )
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['name,age\nJohn,30'], 'test.csv', {
      type: 'text/csv'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    // Simulate FileReader onload
    setTimeout(() => {
      if (mockFileReader.onload) {
        mockFileReader.onload({} as any)
      }
    }, 100)
    
    await waitFor(() => {
      expect(screen.getByText(/analyzing your data/i)).toBeInTheDocument()
    })
  })

  it('handles upload errors gracefully', async () => {
    const user = userEvent.setup()
    const onAnalysisComplete = jest.fn()
    
    mockFetch.mockRejectedValue(new Error('Network error'))
    
    render(<FileUpload onAnalysisComplete={onAnalysisComplete} />)
    
    const file = new File(['name,age\nJohn,30'], 'test.csv', {
      type: 'text/csv'
    })
    
    const input = screen.getByLabelText(/upload file/i)
    await user.upload(input, file)
    
    // Simulate FileReader onload
    setTimeout(() => {
      if (mockFileReader.onload) {
        mockFileReader.onload({} as any)
      }
    }, 100)
    
    await waitFor(() => {
      expect(screen.getByText(/error analyzing/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})