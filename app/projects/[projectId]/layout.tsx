import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Project Dashboard | DataCrafted',
  description: 'Interactive data dashboard for your project',
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}