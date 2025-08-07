'use client'

import { FileUpload } from '@/components/upload/file-upload'
import { BarChart3, BrainCircuit, Sparkles, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { preloadUploadResources, shouldPrefetch } from '@/lib/utils/preloader'
import { useAuth } from '@/lib/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // Redirect authenticated users to projects
  // Commented out to allow testing upload flow without authentication
  // useEffect(() => {
  //   if (!loading && user) {
  //     router.push('/projects')
  //   }
  // }, [user, loading, router])
  
  // Preload critical resources for file upload
  useEffect(() => {
    if (shouldPrefetch()) {
      preloadUploadResources().catch(error => {
        console.warn('Failed to preload upload resources:', error)
      })
    }
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">DataCrafted</span>
          </div>
          <nav className="flex items-center space-x-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
              How it Works
            </a>
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6 mb-12">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Transform Your Data Into
              <span className="block text-primary mt-2">Beautiful Insights</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your spreadsheet and let AI automatically generate stunning dashboards 
              with meaningful insights in seconds.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <FileUpload />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Powerful Features for Data Analysis
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <BrainCircuit className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-muted-foreground">
                Advanced AI algorithms analyze your data patterns and generate relevant insights automatically.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Visualizations</h3>
              <p className="text-muted-foreground">
                Automatically selects the best chart types for your data to maximize clarity and impact.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Results</h3>
              <p className="text-muted-foreground">
                Get your complete dashboard with insights in seconds, no configuration required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Upload Your Data</h3>
                <p className="text-muted-foreground">
                  Simply drag and drop your CSV or Excel file. We support files up to 50MB.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">AI Analysis</h3>
                <p className="text-muted-foreground">
                  Our AI analyzes your data structure, identifies patterns, and determines the best visualizations.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Get Your Dashboard</h3>
                <p className="text-muted-foreground">
                  View your custom dashboard with interactive charts and actionable insights instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2025 DataCrafted. Transform your data into insights.</p>
        </div>
      </footer>
    </main>
  )
}