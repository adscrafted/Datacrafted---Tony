import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing & Subscription',
  description: 'Manage your DataCrafted subscription, view pricing plans, and update payment methods.',
}

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
