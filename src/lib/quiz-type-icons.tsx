/**
 * quiz-type-icons.tsx
 *
 * SVG icon map for each QuestionType. Kept in a separate .tsx file so the
 * core quiz-builder-logic.ts stays JSX-free (pure TypeScript).
 *
 * Import: import { getTypeIcon } from '@/lib/quiz-type-icons'
 */

import React from 'react'
import type { QuestionType } from './quiz-types'

export const TYPE_ICONS: Partial<Record<QuestionType, React.ReactNode>> = {
  mcq: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="3" width="14" height="14" rx="3" fill="#2563EB" fillOpacity="0.15" stroke="#2563EB" strokeWidth="1.5"/>
      <path d="M7 10l2.5 2.5L13 7.5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  multiselect: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="4" width="4" height="4" rx="1" fill="#7C3AED" fillOpacity="0.2" stroke="#7C3AED" strokeWidth="1.4"/>
      <rect x="3" y="12" width="4" height="4" rx="1" fill="#7C3AED" fillOpacity="0.2" stroke="#7C3AED" strokeWidth="1.4"/>
      <path d="M9 6h7M9 14h7" stroke="#7C3AED" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M4 6l1 1 1.5-2" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  truefalse: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="10" cy="10" r="7.5" fill="#16A34A" fillOpacity="0.15" stroke="#16A34A" strokeWidth="1.5"/>
      <path d="M7 10l2 2 4-4" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  poll: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="12" width="3.5" height="5" rx="1" fill="#0F1B3D" fillOpacity="0.8"/>
      <rect x="8.25" y="8" width="3.5" height="9" rx="1" fill="#0F1B3D"/>
      <rect x="13.5" y="5" width="3.5" height="12" rx="1" fill="#0F1B3D" fillOpacity="0.5"/>
    </svg>
  ),
  openended: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M4 6h12M4 10h8M4 14h6" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 12l1.5 1.5L14 17l-1.5-1.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  wordcloud: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <ellipse cx="8" cy="11" rx="5" ry="3.5" fill="#FF8A47" fillOpacity="0.2" stroke="#FF8A47" strokeWidth="1.3"/>
      <ellipse cx="13" cy="9" rx="4" ry="2.8" fill="#FF8A47" fillOpacity="0.2" stroke="#FF8A47" strokeWidth="1.3"/>
      <ellipse cx="10" cy="7" rx="3.5" ry="2.5" fill="#FF8A47" fillOpacity="0.3" stroke="#FF8A47" strokeWidth="1.3"/>
    </svg>
  ),
  qa: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H8l-3 3v-3H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="#0891B2" fillOpacity="0.15" stroke="#0891B2" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 8.5a2 2 0 014 0c0 1-1 1.5-2 2v1" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="0.75" fill="#0891B2"/>
    </svg>
  ),
  rating: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M10 3l1.8 3.6 4 .6-2.9 2.8.7 4L10 12l-3.6 1.9.7-4L4.2 7.2l4-.6z" fill="#EA580C" fillOpacity="0.8" stroke="#EA580C" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="4" width="14" height="3" rx="1.5" fill="#4F46E5"/>
      <rect x="3" y="8.5" width="10" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.65"/>
      <rect x="3" y="13" width="7" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.35"/>
    </svg>
  ),
  case: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="4" y="3" width="12" height="14" rx="2" fill="#DC2626" fillOpacity="0.12" stroke="#DC2626" strokeWidth="1.5"/>
      <path d="M7 7.5h6M7 10.5h6M7 13.5h4" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

export function getTypeIcon(type: QuestionType): React.ReactNode {
  return TYPE_ICONS[type] ?? TYPE_ICONS['mcq'] ?? null
}
