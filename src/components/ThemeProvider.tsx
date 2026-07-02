'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'light', toggle: () => {} })

export function useTheme() { return useContext(ThemeContext) }

const THEME_KEY = 'quizotic_theme'
const THEME_EVENT = 'quizotic-theme'

// localStorage is the source of truth; useSyncExternalStore keeps SSR on
// 'light' (matching the old initial render) and syncs to the saved theme on
// the client. 'storage' keeps multiple tabs in step.
function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, (): Theme => 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '')
  }, [theme])

  const toggle = useCallback(() => {
    localStorage.setItem(THEME_KEY, getTheme() === 'light' ? 'dark' : 'light')
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
