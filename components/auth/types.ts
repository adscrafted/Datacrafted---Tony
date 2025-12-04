export type AuthView = 'signin' | 'signup' | 'reset'

export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultView?: AuthView
}

export interface AuthFormProps {
  onSuccess?: () => void
  onSwitchView?: (view: AuthView) => void
  /** When true, prevents automatic redirect after auth (useful for post-upload flow) */
  skipRedirect?: boolean
}
