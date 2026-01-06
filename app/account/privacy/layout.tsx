import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data & Privacy - DataCrafted',
  description: 'Manage your data and privacy settings',
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
