import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Reset your DataCrafted account password. Enter your email to receive a password reset link.',
  openGraph: {
    title: 'Reset Password | DataCrafted',
    description: 'Reset your DataCrafted account password.',
  },
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
