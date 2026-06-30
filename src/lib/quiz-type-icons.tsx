/**
 * quiz-type-icons.tsx
 *
 * SVG icon map for each QuestionType. Kept in a separate .tsx file so the
 * core quiz-builder-logic.ts stays JSX-free (pure TypeScript).
 *
 * Import: import { getTypeIcon, getTypeIllustration } from '@/lib/quiz-type-icons'
 */

import React from 'react'
import type { QuestionType } from './quiz-types'

// ── Small icons (used in QuestionCanvas type chip) ────────────────────────────

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
  fillblank: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M3 7h6M3 11h10" stroke="#0D9488" strokeWidth="1.7" strokeLinecap="round"/>
      <rect x="3" y="14" width="8" height="2.2" rx="1.1" fill="#0D9488" fillOpacity="0.35"/>
      <rect x="12.5" y="13.4" width="4.5" height="3.4" rx="1" fill="#0D9488" fillOpacity="0.2" stroke="#0D9488" strokeWidth="1.2"/>
    </svg>
  ),
  matching: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="5" cy="6" r="2" fill="#DB2777" fillOpacity="0.25" stroke="#DB2777" strokeWidth="1.3"/>
      <circle cx="5" cy="14" r="2" fill="#DB2777" fillOpacity="0.25" stroke="#DB2777" strokeWidth="1.3"/>
      <circle cx="15" cy="6" r="2" fill="#DB2777" fillOpacity="0.25" stroke="#DB2777" strokeWidth="1.3"/>
      <circle cx="15" cy="14" r="2" fill="#DB2777" fillOpacity="0.25" stroke="#DB2777" strokeWidth="1.3"/>
      <path d="M7 6l6 8M7 14l6-8" stroke="#DB2777" strokeWidth="1.3" strokeLinecap="round"/>
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
  leaderboard: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M6.5 3.5h7v3.5a3.5 3.5 0 01-7 0V3.5z" fill="#F59E0B" fillOpacity="0.25" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6.5 4.5H4.5V6a2 2 0 002 2M13.5 4.5h2V6a2 2 0 01-2 2" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10 10.5v2.5" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 16.5l.8-3h4.4l.8 3z" fill="#F59E0B" fillOpacity="0.25" stroke="#B45309" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
}

export function getTypeIcon(type: QuestionType): React.ReactNode {
  return TYPE_ICONS[type] ?? TYPE_ICONS['mcq'] ?? null
}

// ── Large illustrations (used in AddInteractionPicker cards) ──────────────────
// viewBox="0 0 200 100" landscape — visually preview what each type looks like.

const ILLUSTRATIONS: Partial<Record<QuestionType, React.ReactNode>> = {

  // 4 colored answer tiles (A/B/C/D) — mirrors the actual quiz canvas
  mcq: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      <rect x="10" y="8" width="85" height="37" rx="7" fill="#F23A5C"/>
      <circle cx="24" cy="26.5" r="9" fill="rgba(255,255,255,0.22)"/>
      <text x="24" y="30.5" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif">A</text>
      <rect x="38" y="21" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="38" y="29" width="32" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>

      <rect x="105" y="8" width="85" height="37" rx="7" fill="#2D7FF9"/>
      <circle cx="119" cy="26.5" r="9" fill="rgba(255,255,255,0.22)"/>
      <text x="119" y="30.5" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif">B</text>
      <rect x="133" y="21" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="133" y="29" width="36" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>

      <rect x="10" y="53" width="85" height="37" rx="7" fill="#D9760F"/>
      <circle cx="24" cy="71.5" r="9" fill="rgba(255,255,255,0.22)"/>
      <text x="24" y="75.5" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif">C</text>
      <rect x="38" y="66" width="52" height="5" rx="2.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="38" y="74" width="38" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>

      <rect x="105" y="53" width="85" height="37" rx="7" fill="#119B57"/>
      <circle cx="119" cy="71.5" r="9" fill="rgba(255,255,255,0.22)"/>
      <text x="119" y="75.5" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="system-ui,sans-serif">D</text>
      <rect x="133" y="66" width="44" height="5" rx="2.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="133" y="74" width="30" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
    </svg>
  ),

  // Checkbox list — 2 checked (purple), 2 unchecked
  multiselect: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Row 1 — checked */}
      <rect x="22" y="12" width="16" height="16" rx="4" fill="#7C3AED"/>
      <path d="M26 20l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="48" y="15" width="120" height="10" rx="5" fill="#7C3AED" fillOpacity="0.25"/>

      {/* Row 2 — checked */}
      <rect x="22" y="36" width="16" height="16" rx="4" fill="#7C3AED"/>
      <path d="M26 44l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="48" y="39" width="90" height="10" rx="5" fill="#7C3AED" fillOpacity="0.25"/>

      {/* Row 3 — unchecked */}
      <rect x="22" y="60" width="16" height="16" rx="4" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4"/>
      <rect x="48" y="63" width="110" height="10" rx="5" fill="#7C3AED" fillOpacity="0.1"/>

      {/* Row 4 — unchecked */}
      <rect x="22" y="84" width="16" height="12" rx="4" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4"/>
      <rect x="48" y="86" width="75" height="8" rx="4" fill="#7C3AED" fillOpacity="0.1"/>
    </svg>
  ),

  // Two large pill buttons: green "True" (✓) and red "False" (✗)
  // viewBox wider (260×100) to match the ~2.3:1 card aspect ratio — no letterboxing.
  // Both marks are geometrically centered in their 110px-wide buttons
  // (True center x=67, False center x=193) with symmetric arms and round
  // joins — the old check was left-shifted and its asymmetric join produced
  // a dark overlap artifact.
  truefalse: (
    <svg viewBox="0 0 260 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block">
      {/* True button — center (67, 50) */}
      <rect x="12" y="12" width="110" height="76" rx="14" fill="#16A34A"/>
      {/* Checkmark: short arm (48,50)->(61,64), long arm ->(86,34); midpoint x≈67 */}
      <path d="M48 50l13 14 25-30" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>

      {/* False button — center (193, 50) */}
      <rect x="138" y="12" width="110" height="76" rx="14" fill="#DC2626"/>
      {/* X mark: two strokes crossing at (193, 50) */}
      <path d="M175 32l36 36M211 32l-36 36" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  ),

  // Horizontal bar chart (poll results view)
  poll: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Bar 1 — longest */}
      <rect x="18" y="14" width="148" height="16" rx="8" fill="#0F1B3D"/>
      <rect x="18" y="14" width="148" height="16" rx="8" fill="#0F1B3D"/>
      <text x="172" y="26" fontSize="9" fill="#0F1B3D" fontFamily="system-ui,sans-serif" fontWeight="600">58%</text>

      {/* Bar 2 */}
      <rect x="18" y="38" width="108" height="16" rx="8" fill="#0F1B3D" fillOpacity="0.65"/>
      <text x="132" y="50" fontSize="9" fill="#0F1B3D" fontFamily="system-ui,sans-serif" fontWeight="600">42%</text>

      {/* Bar 3 */}
      <rect x="18" y="62" width="70" height="16" rx="8" fill="#0F1B3D" fillOpacity="0.4"/>
      <text x="94" y="74" fontSize="9" fill="#0F1B3D" fontFamily="system-ui,sans-serif" fontWeight="600">27%</text>

      {/* Bar 4 */}
      <rect x="18" y="86" width="44" height="11" rx="5.5" fill="#0F1B3D" fillOpacity="0.2"/>
    </svg>
  ),

  // 5-star rating row — 3 filled, 2 outline
  rating: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Stars centered at y=50 */}
      {/* Star 1 — filled */}
      <path d="M30,28 L34,40 L47,40 L37,48 L41,60 L30,52 L19,60 L23,48 L13,40 L26,40 Z" fill="#EA580C"/>
      {/* Star 2 — filled */}
      <path d="M68,28 L72,40 L85,40 L75,48 L79,60 L68,52 L57,60 L61,48 L51,40 L64,40 Z" fill="#EA580C"/>
      {/* Star 3 — filled */}
      <path d="M106,28 L110,40 L123,40 L113,48 L117,60 L106,52 L95,60 L99,48 L89,40 L102,40 Z" fill="#EA580C"/>
      {/* Star 4 — outline */}
      <path d="M144,28 L148,40 L161,40 L151,48 L155,60 L144,52 L133,60 L137,48 L127,40 L140,40 Z" fill="none" stroke="#EA580C" strokeWidth="1.5" opacity="0.4"/>
      {/* Star 5 — outline */}
      <path d="M182,28 L186,40 L199,40 L189,48 L193,60 L182,52 L171,60 L175,48 L165,40 L178,40 Z" fill="none" stroke="#EA580C" strokeWidth="1.5" opacity="0.4"/>

      {/* Score label */}
      <rect x="70" y="70" width="60" height="18" rx="9" fill="#EA580C" fillOpacity="0.12"/>
      <text x="100" y="83" fontSize="10" fill="#EA580C" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="700">3.0 / 5</text>
    </svg>
  ),

  // Numbered ranking list — 3 items, top item highlighted
  ranking: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Row 1 — top rank, full highlight */}
      <rect x="14" y="10" width="172" height="22" rx="7" fill="#4F46E5"/>
      <circle cx="28" cy="21" r="9" fill="rgba(255,255,255,0.25)"/>
      <text x="28" y="25.5" fontSize="9" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">1</text>
      <rect x="46" y="16" width="110" height="6" rx="3" fill="rgba(255,255,255,0.55)"/>
      <rect x="46" y="24" width="70" height="4" rx="2" fill="rgba(255,255,255,0.35)"/>

      {/* Row 2 */}
      <rect x="14" y="39" width="172" height="20" rx="7" fill="#4F46E5" fillOpacity="0.18"/>
      <circle cx="28" cy="49" r="8" fill="#4F46E5" fillOpacity="0.4"/>
      <text x="28" y="53" fontSize="9" fill="#4F46E5" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">2</text>
      <rect x="46" y="44" width="90" height="5" rx="2.5" fill="#4F46E5" fillOpacity="0.4"/>
      <rect x="46" y="52" width="60" height="3.5" rx="1.75" fill="#4F46E5" fillOpacity="0.25)"/>

      {/* Row 3 */}
      <rect x="14" y="66" width="172" height="20" rx="7" fill="#4F46E5" fillOpacity="0.1"/>
      <circle cx="28" cy="76" r="8" fill="#4F46E5" fillOpacity="0.2"/>
      <text x="28" y="80" fontSize="9" fill="#4F46E5" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">3</text>
      <rect x="46" y="71" width="70" height="5" rx="2.5" fill="#4F46E5" fillOpacity="0.25"/>
      <rect x="46" y="79" width="45" height="3.5" rx="1.75" fill="#4F46E5" fillOpacity="0.15"/>
    </svg>
  ),

  // Text input box with cursor + answer lines below
  openended: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Input field */}
      <rect x="18" y="10" width="164" height="30" rx="8" fill="white" stroke="#D97706" strokeWidth="1.5"/>
      {/* Cursor blinking line */}
      <rect x="30" y="18" width="2" height="14" rx="1" fill="#D97706"/>
      {/* Placeholder "text" bars */}
      <rect x="38" y="21" width="60" height="5" rx="2.5" fill="#D97706" fillOpacity="0.3"/>

      {/* Response lines */}
      <rect x="18" y="52" width="148" height="7" rx="3.5" fill="#D97706" fillOpacity="0.2"/>
      <rect x="18" y="65" width="122" height="7" rx="3.5" fill="#D97706" fillOpacity="0.15"/>
      <rect x="18" y="78" width="88" height="7" rx="3.5" fill="#D97706" fillOpacity="0.1"/>
    </svg>
  ),

  // Word cloud — varying sized "word bubbles"
  wordcloud: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Large center word */}
      <rect x="56" y="28" width="88" height="22" rx="11" fill="#FF8A47" fillOpacity="0.8"/>
      <text x="100" y="43" fontSize="13" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">amazing</text>

      {/* Medium words */}
      <rect x="12" y="14" width="52" height="16" rx="8" fill="#FF8A47" fillOpacity="0.55"/>
      <text x="38" y="26" fontSize="10" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">great</text>

      <rect x="140" y="18" width="46" height="14" rx="7" fill="#FF8A47" fillOpacity="0.5"/>
      <text x="163" y="29" fontSize="9" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">wow!</text>

      <rect x="18" y="62" width="38" height="14" rx="7" fill="#FF8A47" fillOpacity="0.45"/>
      <text x="37" y="73" fontSize="9" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">fun</text>

      <rect x="72" y="60" width="56" height="16" rx="8" fill="#FF8A47" fillOpacity="0.6"/>
      <text x="100" y="72" fontSize="10" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">useful</text>

      <rect x="140" y="58" width="42" height="14" rx="7" fill="#FF8A47" fillOpacity="0.4"/>
      <text x="161" y="69" fontSize="9" fill="white" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">easy</text>

      {/* Small words */}
      <rect x="28" y="38" width="28" height="12" rx="6" fill="#FF8A47" fillOpacity="0.35"/>
      <text x="42" y="48" fontSize="8" fill="#FF8A47" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">yes</text>

      <rect x="154" y="38" width="28" height="12" rx="6" fill="#FF8A47" fillOpacity="0.3"/>
      <text x="168" y="48" fontSize="8" fill="#FF8A47" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">ok!</text>
    </svg>
  ),

  // Two speech bubbles — question + reply
  qa: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Main question bubble */}
      <path d="M14,8 L130,8 Q140,8 140,18 L140,58 Q140,68 130,68 L44,68 L30,82 L30,68 L24,68 Q14,68 14,58 Z" fill="#0891B2" fillOpacity="0.15" stroke="#0891B2" strokeWidth="1.5"/>
      <text x="77" y="30" fontSize="22" fill="#0891B2" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">?</text>
      <rect x="28" y="44" width="90" height="6" rx="3" fill="#0891B2" fillOpacity="0.3"/>

      {/* Reply bubble */}
      <path d="M108,55 L182,55 Q190,55 190,63 L190,88 Q190,96 182,96 L116,96 L108,96 Q100,96 100,88 L100,63 Q100,55 108,55 Z" fill="#0891B2" fillOpacity="0.08" stroke="#0891B2" strokeWidth="1.2" opacity="0.6"/>
      <rect x="108" y="68" width="58" height="5" rx="2.5" fill="#0891B2" fillOpacity="0.25"/>
      <rect x="108" y="78" width="42" height="5" rx="2.5" fill="#0891B2" fillOpacity="0.15"/>
    </svg>
  ),

  // Scenario card — header bar + context lines + options
  case: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Scenario header bar */}
      <rect x="14" y="8" width="172" height="22" rx="7" fill="#DC2626"/>
      <rect x="24" y="14" width="100" height="5" rx="2.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="24" y="21" width="70" height="4" rx="2" fill="rgba(255,255,255,0.4)"/>

      {/* Context text lines */}
      <rect x="14" y="38" width="155" height="6" rx="3" fill="#DC2626" fillOpacity="0.2"/>
      <rect x="14" y="50" width="140" height="6" rx="3" fill="#DC2626" fillOpacity="0.15"/>
      <rect x="14" y="62" width="120" height="6" rx="3" fill="#DC2626" fillOpacity="0.12"/>

      {/* Options */}
      <rect x="14" y="78" width="80" height="14" rx="5" fill="#DC2626" fillOpacity="0.12" stroke="#DC2626" strokeWidth="1" strokeOpacity="0.3"/>
      <text x="54" y="89" fontSize="8.5" fill="#DC2626" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">Option A</text>

      <rect x="106" y="78" width="80" height="14" rx="5" fill="#DC2626" fillOpacity="0.12" stroke="#DC2626" strokeWidth="1" strokeOpacity="0.3"/>
      <text x="146" y="89" fontSize="8.5" fill="#DC2626" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="600">Option B</text>
    </svg>
  ),

  // Winners' podium — 1st (center, tallest) with a trophy, 2nd left, 3rd right
  leaderboard: (
    <svg viewBox="0 0 200 100" width="100%" height="88" className="block">
      {/* Trophy above #1 */}
      <path d="M94 10h12v5a6 6 0 01-12 0z" fill="#FBBF24" stroke="#B45309" strokeWidth="1.2" strokeLinejoin="round"/>
      <rect x="97.5" y="20.5" width="5" height="4" fill="#B45309"/>
      <rect x="92" y="24" width="16" height="3" rx="1.5" fill="#B45309"/>
      {/* 2nd place — left */}
      <rect x="40" y="52" width="38" height="40" rx="4" fill="#CBD5E1"/>
      <text x="59" y="76" fontSize="14" fill="#fff" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">2</text>
      {/* 1st place — center, tallest */}
      <rect x="81" y="34" width="38" height="58" rx="4" fill="#F59E0B"/>
      <text x="100" y="68" fontSize="16" fill="#fff" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">1</text>
      {/* 3rd place — right */}
      <rect x="122" y="62" width="38" height="30" rx="4" fill="#E2A06B"/>
      <text x="141" y="82" fontSize="13" fill="#fff" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="bold">3</text>
    </svg>
  ),
}

export function getTypeIllustration(type: QuestionType): React.ReactNode {
  return ILLUSTRATIONS[type] ?? ILLUSTRATIONS['mcq'] ?? null
}
