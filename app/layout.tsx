import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/contexts/auth-context'
import { ToastContainer } from '@/components/ui/toast'

// PERFORMANCE OPTIMIZATION: Single optimized Inter font with font-display swap
// Removed: Space_Grotesk, Montserrat, duplicate Inter instances, Google Sans CDN
// This reduces font loading overhead and improves Core Web Vitals (LCP, CLS)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap', // Prevents invisible text during font loading (FOIT)
  preload: true,   // Preload for better performance
})

export const metadata: Metadata = {
  title: {
    default: 'DataCrafted - AI-Powered Data Analytics Dashboard',
    template: '%s | DataCrafted'
  },
  description: 'Transform your data into beautiful insights with AI-powered analytics. Upload CSV, Excel files and get instant visualizations, charts, and data analysis powered by artificial intelligence.',
  keywords: ['data analytics', 'business intelligence', 'data visualization', 'AI analytics', 'CSV analyzer', 'Excel dashboard', 'data insights'],
  authors: [{ name: 'DataCrafted' }],
  creator: 'DataCrafted',
  publisher: 'DataCrafted',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://datacrafted.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'DataCrafted',
    title: 'DataCrafted - AI-Powered Data Analytics Dashboard',
    description: 'Transform your data into beautiful insights with AI-powered analytics. Upload CSV, Excel files and get instant visualizations.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DataCrafted - AI-Powered Data Analytics'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DataCrafted - AI-Powered Data Analytics Dashboard',
    description: 'Transform your data into beautiful insights with AI-powered analytics',
    images: ['/og-image.png'],
    creator: '@datacrafted'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  verification: {
    // Add your verification codes when ready
    // google: 'google-site-verification-code',
    // yandex: 'yandex-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* REMOVED: Google Fonts CDN links - reduces external DNS lookups and improves performance */}
        <style>{`
          :root {
            --color-primary: #0088FE;
            --color-secondary: #00C49F;
            --color-background: #ffffff;
            --color-surface: #f8fafc;
            --color-text: #0f172a;
            --color-muted: #64748b;
            --chart-color-1: #0088FE;
            --chart-color-2: #00C49F;
            --chart-color-3: #FFBB28;
            --chart-color-4: #FF8042;
            --chart-color-5: #8884D8;
            --chart-color-6: #82CA9D;
          }

          [data-theme="dark"] {
            --color-primary: #3b82f6;
            --color-secondary: #10b981;
            --color-background: #0f172a;
            --color-surface: #1e293b;
            --color-text: #f1f5f9;
            --color-muted: #94a3b8;
            --chart-color-1: #3b82f6;
            --chart-color-2: #10b981;
            --chart-color-3: #f59e0b;
            --chart-color-4: #ef4444;
            --chart-color-5: #8b5cf6;
            --chart-color-6: #06b6d4;
          }

          /* Apply transitions only to interactive elements, not globally */
          button, a, input, textarea, select {
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <AuthProvider>
          {children}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  )
}