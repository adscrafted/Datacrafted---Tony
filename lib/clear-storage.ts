// Utility to clear problematic localStorage data
export function clearLargeStorageData() {
  try {
    const key = 'datacrafted-store'
    const storedData = localStorage.getItem(key)
    
    if (storedData) {
      const parsed = JSON.parse(storedData)
      
      // Remove large data fields
      if (parsed.state) {
        delete parsed.state.rawData
        
        // Save back without the large data
        localStorage.setItem(key, JSON.stringify(parsed))
      }
    }
  } catch (error) {
    console.error('Failed to clear storage data:', error)
    // If all else fails, clear the entire key
    localStorage.removeItem('datacrafted-store')
  }
}

// Run this on app initialization to clean up any existing large data
if (typeof window !== 'undefined') {
  clearLargeStorageData()
}