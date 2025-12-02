import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a free DataCrafted account to start analyzing your data with AI-powered insights and visualizations.',
  openGraph: {
    title: 'Sign Up | DataCrafted',
    description: 'Create a free account to start analyzing your data with AI-powered insights.',
  },
}

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
