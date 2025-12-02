import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profile Settings',
  description: 'Manage your DataCrafted profile information, display name, and account preferences.',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
