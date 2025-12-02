import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Interactive data analytics dashboard with AI-powered insights, customizable charts, and real-time data exploration.',
  openGraph: {
    title: 'Dashboard | DataCrafted',
    description: 'Interactive data analytics dashboard with AI-powered insights and customizable visualizations.',
  },
  twitter: {
    title: 'Dashboard | DataCrafted',
    description: 'Interactive data analytics dashboard with AI-powered insights and customizable visualizations.',
  },
  robots: {
    index: false, // Dashboards are user-specific, should not be indexed
    follow: true,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
