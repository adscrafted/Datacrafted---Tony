// Animation utilities for smooth, performant animations

// Easing functions for natural motion
export const easings = {
  // Cubic bezier easing functions
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOutBack: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  easeInOutElastic: 'cubic-bezier(0.5, -0.25, 0.1, 1.25)',
  
  // Spring-based easing
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
}

// Animation durations (in milliseconds)
export const durations = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600
}

// CSS transition classes for Tailwind
export const transitions = {
  // Basic transitions
  all: 'transition-all duration-250 ease-in-out',
  colors: 'transition-colors duration-200 ease-in-out', 
  opacity: 'transition-opacity duration-200 ease-in-out',
  transform: 'transition-transform duration-250 ease-in-out',
  
  // Specialized transitions
  button: 'transition-all duration-150 ease-in-out',
  modal: 'transition-all duration-300 ease-out',
  slideIn: 'transition-transform duration-250 ease-out',
  fadeIn: 'transition-opacity duration-200 ease-in',
  
  // Loading states
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce',
  
  // Hover effects
  hover: 'transition-all duration-200 ease-in-out hover:scale-105',
  hoverLift: 'transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1',
  hoverGlow: 'transition-all duration-200 ease-in-out hover:shadow-md hover:bg-opacity-90'
}

// Animation variants for framer-motion or CSS classes
export const animationVariants = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  },
  
  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
  },
  
  scaleInCenter: {
    initial: { opacity: 0, scale: 0.8, transformOrigin: 'center' },
    animate: { opacity: 1, scale: 1, transformOrigin: 'center' },
    exit: { opacity: 0, scale: 0.8, transformOrigin: 'center' }
  },
  
  // Slide animations
  slideInLeft: {
    initial: { opacity: 0, x: -100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 }
  },
  
  slideInRight: {
    initial: { opacity: 0, x:  100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 100 }
  },
  
  // Stagger container
  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  },
  
  // Loading skeleton
  skeleton: {
    animate: {
      backgroundColor: ['#f3f4f6', '#e5e7eb', '#f3f4f6'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  }
}

// Performance-optimized animation settings
export const performanceSettings = {
  // Reduce motion for accessibility
  respectReducedMotion: true,
  
  // Use transform and opacity for better performance
  gpuAccelerated: {
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
    perspective: 1000
  },
  
  // Contain layout shifts
  containIntrinsic: {
    containIntrinsicSize: 'auto',
    contentVisibility: 'auto'
  }
}

// Utility function to create smooth transitions
export function createTransition(
  property: string | string[],
  duration: number = durations.normal,
  easing: string = easings.easeInOut,
  delay: number = 0
): string {
  const properties = Array.isArray(property) ? property : [property]
  return properties
    .map(prop => `${prop} ${duration}ms ${easing} ${delay}ms`)
    .join(', ')
}

// Check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Animation frame utilities
export function requestAnimationFrame(callback: () => void): number {
  if (typeof window === 'undefined') return 0
  return window.requestAnimationFrame(callback)
}

export function cancelAnimationFrame(id: number): void {
  if (typeof window === 'undefined') return
  window.cancelAnimationFrame(id)
}

// Smooth scroll utility
export function smoothScrollTo(
  element: HTMLElement | string,
  options: ScrollIntoViewOptions = {}
): void {
  const target = typeof element === 'string' 
    ? document.querySelector(element) as HTMLElement
    : element
    
  if (!target) return
  
  const defaultOptions: ScrollIntoViewOptions = {
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'center',
    inline: 'nearest'
  }
  
  target.scrollIntoView({ ...defaultOptions, ...options })
}

// CSS-in-JS animation keyframes
export const keyframes = {
  // Loading animations
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  
  spin: `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `,
  
  bounce: `
    @keyframes bounce {
      0%, 20%, 53%, 80%, 100% {
        animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
        transform: translate3d(0, 0, 0);
      }
      40%, 43% {
        animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
        transform: translate3d(0, -30px, 0) scaleY(1.1);
      }
      70% {
        animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
        transform: translate3d(0, -15px, 0) scaleY(1.05);
      }
      90% {
        transform: translate3d(0, -4px, 0) scaleY(0.95);
      }
    }
  `,
  
  // Progress bar animation
  progressBar: `
    @keyframes progressBar {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(0%); }
    }
  `,
  
  // Shimmer effect for loading
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }
  `,
  
  // Slide in animations
  slideInUp: `
    @keyframes slideInUp {
      0% {
        opacity: 0;
        transform: translate3d(0, 100%, 0);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
    }
  `,
  
  slideInDown: `
    @keyframes slideInDown {
      0% {
        opacity: 0;
        transform: translate3d(0, -100%, 0);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
    }
  `
}

// Performance monitoring for animations
export class AnimationPerformanceMonitor {
  private frameCount = 0
  private lastTime = 0
  private fps = 0
  private monitoring = false
  
  start(): void {
    if (this.monitoring) return
    this.monitoring = true
    this.frameCount = 0
    this.lastTime = performance.now()
    this.measureFPS()
  }
  
  stop(): void {
    this.monitoring = false
  }
  
  private measureFPS(): void {
    if (!this.monitoring) return
    
    const currentTime = performance.now()
    this.frameCount++
    
    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime))
      this.frameCount = 0
      this.lastTime = currentTime
      
      // Log performance warnings
      if (this.fps < 30) {
        console.warn(`Low animation FPS detected: ${this.fps}`)
      }
    }
    
    requestAnimationFrame(() => this.measureFPS())
  }
  
  getFPS(): number {
    return this.fps
  }
}

// Create optimized CSS classes
export function createOptimizedAnimationClass(
  name: string,
  keyframe: string,
  duration: number = durations.normal,
  easing: string = easings.easeInOut,
  fillMode: string = 'both'
): string {
  return `
    .${name} {
      animation: ${name} ${duration}ms ${easing} ${fillMode};
      ${performanceSettings.gpuAccelerated.willChange ? `will-change: ${performanceSettings.gpuAccelerated.willChange};` : ''}
    }
    
    @media (prefers-reduced-motion: reduce) {
      .${name} {
        animation: none;
      }
    }
    
    ${keyframe}
  `
}

// Intersection Observer for scroll-triggered animations
export function createScrollAnimation(
  element: HTMLElement,
  animationClass: string,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1,
    ...options
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add(animationClass)
        observer.unobserve(entry.target)
      }
    })
  }, defaultOptions)
  
  observer.observe(element)
  return observer
}

export default {
  easings,
  durations,
  transitions,
  animationVariants,
  performanceSettings,
  keyframes,
  createTransition,
  prefersReducedMotion,
  smoothScrollTo,
  AnimationPerformanceMonitor,
  createOptimizedAnimationClass,
  createScrollAnimation
}