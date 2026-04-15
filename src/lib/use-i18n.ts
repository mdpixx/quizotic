'use client'

import { useState, useCallback } from 'react'
import en from '@/locales/en.json'
import hi from '@/locales/hi.json'

type Locale = 'en' | 'hi'
type Translations = Record<string, string>

const locales: Record<Locale, Translations> = { en, hi }
const STORAGE_KEY = 'quizotic_locale'

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored && stored in locales) return stored
  const browser = navigator.language.split('-')[0]
  return browser === 'hi' ? 'hi' : 'en'
}

/**
 * Lightweight i18n hook. Returns a `t(key, vars?)` function and the active locale.
 * Call setLocale('hi') to switch language; choice is persisted to localStorage.
 *
 * Usage: const { t, locale, setLocale } = useI18n()
 *        t('join.submitBtn')             → "Join →" / "जॉइन करें →"
 *        t('join.questionOf', { current: 2, total: 10 }) → "Question 2 of 10"
 */
export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale())

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const dict = locales[locale] ?? locales.en
    let str = dict[key] ?? locales.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v))
      }
    }
    return str
  }, [locale])

  return { t, locale, setLocale }
}
