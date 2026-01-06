import type { ThemeVariant } from '../types'

export function applyTheme(theme: ThemeVariant) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function getCurrentTheme(): ThemeVariant {
  const theme = document.documentElement.getAttribute('data-theme') as ThemeVariant
  return theme || 'cyberpunk'
}

export function initializeTheme(theme: ThemeVariant) {
  applyTheme(theme)
}