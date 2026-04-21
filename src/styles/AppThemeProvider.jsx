// src/styles/AppThemeProvider.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '../UserContext.jsx'
import {
  APP_THEMES,
  getAllowedThemesForRole,
  getRoleDefaultTheme,
  getTheme,
} from './appThemes.js'
import { AppThemeContext } from './AppThemeContext.jsx'

function storageKeyForUser(userId, role) {
  return `appTheme:${userId || role || 'guest'}`
}

function applyThemeToDocument(themeId) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const theme = getTheme(themeId)

  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  root.setAttribute('data-app-theme', theme.id)
}

export function AppThemeProvider({ children }) {
  const { user } = useUser()

  const userId = user?.id
  const role = user?.role || 'user'
  const profileThemeId = user?.appTheme
  const allowedThemes = useMemo(() => getAllowedThemesForRole(role), [role])
  const roleDefaultTheme = getRoleDefaultTheme(role)
  const storageKey = useMemo(
    () => storageKeyForUser(userId, role),
    [userId, role]
  )

  const [themeId, setThemeIdState] = useState(roleDefaultTheme)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const fallbackTheme = allowedThemes.includes(roleDefaultTheme)
      ? roleDefaultTheme
      : allowedThemes[0] || 'waterLily'

    try {
      const savedThemeId =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(storageKey)
          : null

      const preferredThemeId =
        (savedThemeId && allowedThemes.includes(savedThemeId) && savedThemeId) ||
        (profileThemeId && allowedThemes.includes(profileThemeId) && profileThemeId) ||
        fallbackTheme

      setThemeIdState(preferredThemeId)
      applyThemeToDocument(preferredThemeId)
    } catch {
      setThemeIdState(fallbackTheme)
      applyThemeToDocument(fallbackTheme)
    } finally {
      setIsReady(true)
    }
  }, [allowedThemes, profileThemeId, roleDefaultTheme, storageKey])

  useEffect(() => {
    if (!isReady) return

    const safeThemeId = allowedThemes.includes(themeId)
      ? themeId
      : roleDefaultTheme

    applyThemeToDocument(safeThemeId)

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, safeThemeId)
      }
    } catch {
      // ignore storage failures
    }
  }, [themeId, isReady, roleDefaultTheme, allowedThemes, storageKey])

  const setThemeId = useCallback(
    (nextThemeId) => {
      if (!allowedThemes.includes(nextThemeId)) return
      setThemeIdState(nextThemeId)
    },
    [allowedThemes]
  )

  const resetTheme = useCallback(() => {
    setThemeIdState(roleDefaultTheme)
  }, [roleDefaultTheme])

  const value = useMemo(() => {
    const safeThemeId = allowedThemes.includes(themeId)
      ? themeId
      : roleDefaultTheme

    return {
      themeId: safeThemeId,
      theme: getTheme(safeThemeId),
      allThemes: APP_THEMES,
      allowedThemes,
      roleDefaultTheme,
      setThemeId,
      resetTheme,
      isReady,
    }
  }, [themeId, allowedThemes, roleDefaultTheme, setThemeId, resetTheme, isReady])

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  )
}
