export type AuthView = 'signin' | 'signup' | 'reset'

export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultView?: AuthView
}

export interface AuthFormProps {
  onSuccess?: () => void
  onSwitchView?: (view: AuthView) => void
}
