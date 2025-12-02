import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your DataCrafted account to access your data analytics dashboards and projects.',
  openGraph: {
    title: 'Sign In | DataCrafted',
    description: 'Sign in to your DataCrafted account.',
  },
}

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
