import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/contexts/auth-context'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="en">
      <head>
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
          
          * {
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}