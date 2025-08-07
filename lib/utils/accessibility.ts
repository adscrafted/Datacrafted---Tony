/**
 * Accessibility utilities for the dashboard application
 */

// ARIA live region announcer
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcer = document.createElement('div')
  announcer.setAttribute('aria-live', priority)
  announcer.setAttribute('aria-atomic', 'true')
  announcer.setAttribute('class', 'sr-only')
  announcer.textContent = message
  
  document.body.appendChild(announcer)
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcer)
  }, 1000)
}

// Focus management utilities
export const focusElement = (selector: string, timeout = 100) => {
  setTimeout(() => {
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      element.focus()
    }
  }, timeout)
}

export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
  }

  container.addEventListener('keydown', handleTabKey)
  return () => container.removeEventListener('keydown', handleTabKey)
}

// Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = hexToRgb(color)
    if (!rgb) return 0
    
    const [r, g, b] = rgb.map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05)
}

const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null
}

export const isAccessibleContrast = (foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean => {
  const ratio = getContrastRatio(foreground, background)
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7
}

// Keyboard navigation helpers
export const handleArrowNavigation = (
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect?: (index: number) => void
) => {
  let newIndex = currentIndex
  
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      newIndex = (currentIndex + 1) % items.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1
      break
    case 'Home':
      newIndex = 0
      break
    case 'End':
      newIndex = items.length - 1
      break
    case 'Enter':
    case ' ':
      if (onSelect) {
        onSelect(currentIndex)
        return currentIndex
      }
      break
    default:
      return currentIndex
  }
  
  if (newIndex !== currentIndex) {
    event.preventDefault()
    items[newIndex]?.focus()
  }
  
  return newIndex
}

// Screen reader text utilities
export const generateScreenReaderText = {
  chartDescription: (chartType: string, title: string, dataPoints: number): string => {
    return `${chartType} chart titled "${title}" with ${dataPoints} data points`
  },
  
  filterStatus: (activeFilters: number, totalRows: number, filteredRows: number): string => {
    if (activeFilters === 0) {
      return `No filters applied. Showing all ${totalRows} rows.`
    }
    return `${activeFilters} filter${activeFilters === 1 ? '' : 's'} applied. Showing ${filteredRows} of ${totalRows} rows.`
  },
  
  themeChange: (themeName: string, mode: string): string => {
    return `Theme changed to ${themeName} in ${mode} mode`
  },
  
  customizationAction: (action: string, target: string): string => {
    return `${action} applied to ${target}`
  }
}

// Reduced motion utilities
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const respectMotionPreference = (animationClass: string, reduceClass: string = ''): string => {
  return prefersReducedMotion() ? reduceClass : animationClass
}