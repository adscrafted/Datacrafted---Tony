import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Developer Tools',
  description: 'DataCrafted developer utilities and debugging tools.',
  robots: {
    index: false, // Dev tools should never be indexed
    follow: false,
  },
}

export default function DevLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
