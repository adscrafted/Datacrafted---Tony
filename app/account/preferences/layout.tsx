import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preferences - DataCrafted',
  description: 'Customize your DataCrafted experience',
}

export default function PreferencesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
