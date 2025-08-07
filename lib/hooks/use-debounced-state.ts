import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Custom hook for debounced state updates
 * Prevents excessive re-renders during rapid state changes
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const updateValue = useCallback((newValue: T) => {
    setValue(newValue)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(newValue)
    }, delay)
  }, [delay])

  const forceUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setDebouncedValue(value)
  }, [value])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [value, debouncedValue, updateValue, forceUpdate]
}