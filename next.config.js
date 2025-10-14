/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Optimize for production builds
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://api.openai.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
              "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
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
    }

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