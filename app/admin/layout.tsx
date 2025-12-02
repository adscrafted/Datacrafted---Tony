import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'DataCrafted system administration - manage database, monitor stats, and perform maintenance.',
  robots: {
    index: false, // Admin pages should never be indexed
    follow: false,
  },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
