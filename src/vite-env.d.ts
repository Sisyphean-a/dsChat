/// <reference types="vite/client" />

import type { UtoolsApi } from './types/utools'

declare global {
  interface Window {
    utools?: UtoolsApi
  }
}

export {}
