/**
 * CSS and rendering optimization utilities
 */

/**
 * Enable CSS containment for better performance
 */
export function enableCSSContainment(element: HTMLElement) {
  // CSS containment helps browsers optimize rendering
  element.style.contain = 'layout style paint'
}

/**
 * Use will-change for animations
 */
export function prepareForAnimation(element: HTMLElement, properties: string[]) {
  element.style.willChange = properties.join(', ')
  
  // Remove will-change after animation
  return () => {
    element.style.willChange = 'auto'
  }
}

/**
 * Force GPU acceleration
 */
export function enableGPUAcceleration(element: HTMLElement) {
  // Force element onto GPU layer
  element.style.transform = 'translateZ(0)'
  element.style.backfaceVisibility = 'hidden'
  element.style.perspective = '1000px'
}

/**
 * Optimize scrolling performance
 */
export function optimizeScroll(element: HTMLElement) {
  // Passive event listeners
  element.addEventListener('scroll', () => {}, { passive: true })
  
  // Smooth scrolling with GPU
  element.style.scrollBehavior = 'smooth'
  element.style.overscrollBehavior = 'contain'

  // Enable momentum scrolling on iOS
  ;(element.style as any).webkitOverflowScrolling = 'touch'
}

/**
 * Critical CSS extraction
 */
export function extractCriticalCSS(html: string): string {
  // This would normally use a library like critical
  // For now, we'll return a placeholder
  return `
    /* Critical CSS */
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; }
    /* Add more critical styles */
  `
}

/**
 * Dynamic CSS injection for better performance
 */
export function injectStyles(css: string, id?: string) {
  const styleId = id || `dynamic-styles-${Date.now()}`
  
  // Check if style already exists
  let styleElement = document.getElementById(styleId) as HTMLStyleElement
  
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = styleId
    document.head.appendChild(styleElement)
  }
  
  styleElement.textContent = css
  
  return () => {
    styleElement.remove()
  }
}

/**
 * CSS-in-JS optimization
 */
export function optimizedStyled(styles: Record<string, any>) {
  // Convert styles to CSS string
  const css = Object.entries(styles)
    .map(([prop, value]) => {
      const cssProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
      return `${cssProp}: ${value};`
    })
    .join(' ')
  
  return css
}

/**
 * Reduce paint areas
 */
export function isolateRepaint(element: HTMLElement) {
  // Create a new stacking context
  element.style.position = 'relative'
  element.style.zIndex = '0'
  element.style.isolation = 'isolate'
}

/**
 * Font loading optimization
 */
export async function optimizeFonts() {
  if (!('fonts' in document)) return
  
  try {
    // Wait for critical fonts
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout
    ])
  } catch (error) {
    console.warn('Font loading timeout:', error)
  }
}

/**
 * Animation frame batching
 */
class AnimationBatcher {
  private callbacks: Set<FrameRequestCallback> = new Set()
  private rafId: number | null = null

  add(callback: FrameRequestCallback) {
    this.callbacks.add(callback)
    this.schedule()
  }

  remove(callback: FrameRequestCallback) {
    this.callbacks.delete(callback)
  }

  private schedule() {
    if (this.rafId !== null) return
    
    this.rafId = requestAnimationFrame((time) => {
      this.rafId = null
      
      // Execute all callbacks
      this.callbacks.forEach(callback => {
        try {
          callback(time)
        } catch (error) {
          console.error('Animation callback error:', error)
        }
      })
    })
  }
}

export const animationBatcher = new AnimationBatcher()

/**
 * Layout thrashing prevention
 */
export function batchDOM(reads: (() => void)[], writes: (() => void)[]) {
  // Execute all reads first
  reads.forEach(read => read())
  
  // Then execute all writes
  requestAnimationFrame(() => {
    writes.forEach(write => write())
  })
}