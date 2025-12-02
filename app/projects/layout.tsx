import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Manage your data analytics projects. View, create, and organize your datasets and dashboards in one place.',
  openGraph: {
    title: 'Projects | DataCrafted',
    description: 'Manage your data analytics projects. View, create, and organize your datasets and dashboards.',
  },
  twitter: {
    title: 'Projects | DataCrafted',
    description: 'Manage your data analytics projects. View, create, and organize your datasets and dashboards.',
  },
}

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
