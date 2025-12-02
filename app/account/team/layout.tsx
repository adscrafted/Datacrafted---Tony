import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Team Management',
  description: 'Invite team members, manage roles, and collaborate on data analytics projects.',
}

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
