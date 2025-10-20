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
  title: 'DataCrafted - AI-Powered Data Analytics Dashboard',
  description: 'Transform your data into beautiful insights with AI-powered analytics',
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
        <AuthProvider>
          {children}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  )
}