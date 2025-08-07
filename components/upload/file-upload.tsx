'use client'

import { DynamicFileUpload } from './dynamic-file-upload'

// Backwards compatibility wrapper
export function FileUpload() {
  return <DynamicFileUpload />
}