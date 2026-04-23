import { createContext, useContext } from 'react'

export const AppThemeContext = createContext(null)

export function useAppTheme() {
  const context = useContext(AppThemeContext)

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider')
  }

  return context
}
