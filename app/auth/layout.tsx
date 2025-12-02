import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Authentication',
    template: '%s | DataCrafted'
  },
  description: 'Sign in or create an account to access DataCrafted analytics platform. Secure authentication powered by Firebase.',
  robots: {
    index: false, // Auth pages should not be indexed
    follow: true,
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
