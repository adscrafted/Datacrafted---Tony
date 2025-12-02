/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployments
  // This creates a minimal production build in .next/standalone
  output: 'standalone',

  // PRODUCTION: Remove console.log statements in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep console.error and console.warn
    } : false,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // PERFORMANCE OPTIMIZATION: Optimize package imports for tree-shaking
    // Automatically transforms imports to use tree-shakable paths
    optimizePackageImports: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'recharts',
      'lucide-react',
    ],
  },
  // Optimize for production builds
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,

  // PERFORMANCE OPTIMIZATION: Image optimization settings
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Security headers - MOVED TO MIDDLEWARE
  // CSP with nonces is now handled in middleware.ts for better security
  // This allows per-request nonce generation and removes unsafe-inline/unsafe-eval
  // See: /middleware.ts and /lib/security/csp.ts
  //
  // Static headers can still be set here for routes not covered by middleware
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Note: CSP is now handled in middleware.ts with nonce-based security
          // These are fallback headers for static assets
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
        ],
      },
    ]
  },
  
  // Bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      }

      // PERFORMANCE OPTIMIZATION: Add webpack alias for better tree-shaking
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use lodash-es for better tree-shaking
        'lodash': 'lodash-es',
      }
    }

    // PERFORMANCE OPTIMIZATION: Ignore moment.js locales (saves ~500KB)
    // moment is often included as a dependency of chart libraries
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      })
    )

    // Add bundle analysis in development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      )
    }

    // Optimize chunks for better caching and performance
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 250000,
        cacheGroups: {
          // Core React and Next.js
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            priority: 40,
            enforce: true,
          },
          // Charts and visualization libraries
          charts: {
            test: /[\\/]node_modules[\\/](recharts|react-grid-layout|react-window)[\\/]/,
            name: 'charts',
            chunks: 'all',
            priority: 30,
          },
          // File processing libraries
          fileProcessing: {
            test: /[\\/]node_modules[\\/](papaparse|xlsx)[\\/]/,
            name: 'file-processing',
            chunks: 'all',
            priority: 25,
          },
          // UI libraries
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority)[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 20,
          },
          // State management
          store: {
            test: /[\\/]node_modules[\\/](zustand)[\\/]/,
            name: 'store',
            chunks: 'all',
            priority: 15,
          },
          // Common vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            minChunks: 1,
          },
        },
      }
      
      // Enable tree shaking for better bundle optimization  
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
    }

    // Web Workers are supported natively in Next.js 13+
    // No need for worker-loader configuration

    return config
  },
}

module.exports = nextConfig