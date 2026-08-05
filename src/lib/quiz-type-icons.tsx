/**
 * SVG icon and preview map for every quiz question type.
 *
 * Small icons identify the type throughout the builder. Larger previews are
 * used only in AddInteractionPicker and deliberately show the participant's
 * response mechanism so adjacent types remain distinguishable at a glance.
 */

import React from 'react'
import type { QuestionType } from './quiz-types'

// ── Small icons (used in QuestionCanvas type chip) ────────────────────────────

export const TYPE_ICONS: Partial<Record<QuestionType, React.ReactNode>> = {
  mcq: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle data-control="radio" cx="10" cy="10" r="7.5" fill="#2563EB" fillOpacity="0.1" stroke="#2563EB" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="3.5" fill="#2563EB"/>
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
  return TYPE_ICONS[type] ?? TYPE_ICONS.mcq ?? null
}

// ── Large semantic previews (used in AddInteractionPicker cards) ─────────────

function PreviewSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 72"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className="block"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const ILLUSTRATIONS: Partial<Record<QuestionType, React.ReactNode>> = {
  // Same 2×2 answer layout as multi-select, but circular controls make the
  // one-answer rule visible without relying on the card title.
  mcq: (
    <PreviewSvg>
      <rect x="3" y="4" width="114" height="28" rx="7" fill="#F5F9FF" stroke="#7CB0FF" strokeWidth="1.5"/>
      <circle data-control="radio" cx="16" cy="18" r="6" fill="white" stroke="#3478F6" strokeWidth="1.5"/>
      <circle cx="16" cy="18" r="3" fill="#3478F6"/>
      <text x="29" y="21" fill="#2965C7" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">A</text>
      <rect x="42" y="15" width="62" height="6" rx="3" fill="#3478F6" fillOpacity="0.28"/>

      <rect x="123" y="4" width="114" height="28" rx="7" fill="#FFF9FC" stroke="#E8BED1" strokeWidth="1.2"/>
      <circle data-control="radio" cx="136" cy="18" r="6" fill="white" stroke="#D66A9A" strokeWidth="1.5"/>
      <text x="149" y="21" fill="#B64E7C" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">B</text>
      <rect x="162" y="15" width="62" height="6" rx="3" fill="#D66A9A" fillOpacity="0.25"/>

      <rect x="3" y="40" width="114" height="28" rx="7" fill="#FFFCF7" stroke="#E4C58F" strokeWidth="1.2"/>
      <circle data-control="radio" cx="16" cy="54" r="6" fill="white" stroke="#D49A3D" strokeWidth="1.5"/>
      <text x="29" y="57" fill="#A87017" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">C</text>
      <rect x="42" y="51" width="62" height="6" rx="3" fill="#D49A3D" fillOpacity="0.25"/>

      <rect x="123" y="40" width="114" height="28" rx="7" fill="#F7FCFA" stroke="#9AD2C2" strokeWidth="1.2"/>
      <circle data-control="radio" cx="136" cy="54" r="6" fill="white" stroke="#31A782" strokeWidth="1.5"/>
      <text x="149" y="57" fill="#218365" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">D</text>
      <rect x="162" y="51" width="62" height="6" rx="3" fill="#31A782" fillOpacity="0.25"/>
    </PreviewSvg>
  ),

  multiselect: (
    <PreviewSvg>
      {[4, 40].map((y, row) => [3, 123].map((x, col) => {
        const checked = row === col
        const label = String.fromCharCode(65 + row * 2 + col)
        return (
          <g key={`${row}-${col}`}>
            <rect x={x} y={y} width="114" height="28" rx="7" fill={checked ? '#F7F3FF' : '#FCFAFF'} stroke={checked ? '#A783FA' : '#D5C7F6'} strokeWidth={checked ? '1.5' : '1.2'}/>
            <rect data-control="checkbox" x={x + 8} y={y + 8} width="12" height="12" rx="3" fill={checked ? '#7138EE' : 'white'} stroke="#8B5CF6" strokeWidth="1.4"/>
            {checked && <path d={`M${x + 11} ${y + 14}l2.2 2.2 4-5`} fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>}
            <text x={x + 27} y={y + 18} fill="#6130C9" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">{label}</text>
            <rect x={x + 40} y={y + 11} width="62" height="6" rx="3" fill="#7138EE" fillOpacity={checked ? '0.3' : '0.18'}/>
          </g>
        )
      }))}
    </PreviewSvg>
  ),

  truefalse: (
    <PreviewSvg>
      <circle cx="8" cy="9" r="3" fill="#AAB4C4"/>
      <rect x="17" y="6" width="100" height="6" rx="3" fill="#CBD2DD"/>
      <rect x="123" y="6" width="52" height="6" rx="3" fill="#CBD2DD" fillOpacity="0.65"/>

      <rect x="3" y="24" width="114" height="42" rx="9" fill="#EAF8F2" stroke="#8FD2B4" strokeWidth="1.4"/>
      <rect x="21" y="35" width="20" height="20" rx="6" fill="#16A36A"/>
      <path d="M27 45l3 3 6-7" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="51" y="49" fill="#137A50" fontSize="12" fontWeight="800" fontFamily="system-ui,sans-serif">True</text>

      <rect x="123" y="24" width="114" height="42" rx="9" fill="#FFF0F2" stroke="#F0A3AE" strokeWidth="1.4"/>
      <rect x="141" y="35" width="20" height="20" rx="6" fill="#EA4D60"/>
      <path d="M147 41l8 8M155 41l-8 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <text x="171" y="49" fill="#B83B4C" fontSize="12" fontWeight="800" fontFamily="system-ui,sans-serif">False</text>
    </PreviewSvg>
  ),

  fillblank: (
    <PreviewSvg>
      <text x="4" y="12" fill="#526076" fontSize="8.5" fontWeight="700" fontFamily="system-ui,sans-serif">Plants turn light into</text>
      <rect x="94" y="2" width="52" height="14" rx="3" fill="#E2F6F3"/>
      <line x1="94" y1="16" x2="146" y2="16" stroke="#0F9A91" strokeWidth="1.5"/>
      <rect x="101" y="5" width="1.5" height="8" rx="0.75" fill="#0F9A91"/>

      <rect x="3" y="23" width="234" height="28" rx="7" fill="white" stroke="#74C9C1" strokeWidth="1.4"/>
      <text x="14" y="41" fill="#91A0B1" fontSize="9" fontWeight="650" fontFamily="system-ui,sans-serif">Type answer</text>

      <text x="4" y="64" fill="#8A96A7" fontSize="7" fontWeight="700" fontFamily="system-ui,sans-serif">Accepts</text>
      <rect x="40" y="55" width="48" height="13" rx="6.5" fill="#E4F6F3"/>
      <text x="64" y="64" textAnchor="middle" fill="#287D76" fontSize="7" fontWeight="800" fontFamily="system-ui,sans-serif">glucose</text>
      <rect x="93" y="55" width="38" height="13" rx="6.5" fill="#E4F6F3"/>
      <text x="112" y="64" textAnchor="middle" fill="#287D76" fontSize="7" fontWeight="800" fontFamily="system-ui,sans-serif">sugar</text>
    </PreviewSvg>
  ),

  matching: (
    <PreviewSvg>
      <path d="M76 12C117 12 123 60 164 60M76 36C116 36 124 12 164 12M76 60C116 60 124 36 164 36" fill="none" stroke="#D94C86" strokeWidth="1.7" strokeLinecap="round" opacity="0.62"/>
      {[4, 28, 52].map(y => (
        <g key={`left-${y}`}>
          <rect x="3" y={y} width="73" height="16" rx="5" fill="white" stroke="#EAA0BF" strokeWidth="1.2"/>
          <rect x="13" y={y + 6} width="42" height="4" rx="2" fill="#D94C86" fillOpacity="0.36"/>
        </g>
      ))}
      {[4, 28, 52].map(y => (
        <g key={`right-${y}`}>
          <rect x="164" y={y} width="73" height="16" rx="5" fill="white" stroke="#EAA0BF" strokeWidth="1.2"/>
          <rect x="174" y={y + 6} width="42" height="4" rx="2" fill="#D94C86" fillOpacity="0.36"/>
        </g>
      ))}
    </PreviewSvg>
  ),

  poll: (
    <PreviewSvg>
      {[
        { y: 8, width: 132, opacity: 0.8, value: '42%' },
        { y: 31, width: 92, opacity: 0.62, value: '31%' },
        { y: 54, width: 58, opacity: 0.42, value: '18%' },
      ].map(row => (
        <g key={row.y}>
          <circle cx="10" cy={row.y + 5} r="5" fill="white" stroke="#738198" strokeWidth="1.4"/>
          <rect x="23" y={row.y + 1} width="178" height="8" rx="4" fill="#E4E8EE"/>
          <rect x="23" y={row.y + 1} width={row.width} height="8" rx="4" fill="#59677E" fillOpacity={row.opacity}/>
          <text x="234" y={row.y + 8} fill="#647086" fontSize="8" fontWeight="800" textAnchor="end" fontFamily="system-ui,sans-serif">{row.value}</text>
        </g>
      ))}
    </PreviewSvg>
  ),

  rating: (
    <PreviewSvg>
      <rect x="77" y="3" width="86" height="5" rx="2.5" fill="#E6C797"/>
      {[42, 81, 120, 159, 198].map((x, index) => (
        <g key={x}>
          <text x={x} y="38" textAnchor="middle" fill={index < 4 ? '#D88916' : '#D2D8E1'} fontSize="26" fontWeight="800" fontFamily="system-ui,sans-serif">{index < 4 ? '★' : '☆'}</text>
          <text x={x} y="49" textAnchor="middle" fill="#8F9AAB" fontSize="7" fontWeight="800" fontFamily="system-ui,sans-serif">{index + 1}</text>
        </g>
      ))}
      <rect x="91" y="55" width="58" height="14" rx="7" fill="#FFF0D4"/>
      <text x="120" y="65" textAnchor="middle" fill="#A65E0C" fontSize="7.5" fontWeight="850" fontFamily="system-ui,sans-serif">4 out of 5</text>
    </PreviewSvg>
  ),

  ranking: (
    <PreviewSvg>
      {[4, 27, 50].map((y, index) => (
        <g key={y}>
          <rect x="3" y={y} width="234" height="18" rx="6" fill="white" stroke="#CFD4F7" strokeWidth="1.2"/>
          {[0, 1, 2].map(dot => <circle key={dot} cx={11 + dot * 3} cy={y + 9} r="1" fill="#A1A9B8"/>)}
          <circle cx="30" cy={y + 9} r="7" fill="#5965D8"/>
          <text x="30" y={y + 12} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="900" fontFamily="system-ui,sans-serif">{index + 1}</text>
          <rect x="43" y={y + 6} width={index === 0 ? 154 : index === 1 ? 118 : 80} height="5" rx="2.5" fill="#AAB1EE"/>
          <text x="226" y={y + 12} textAnchor="middle" fill="#8791A2" fontSize="9" fontFamily="system-ui,sans-serif">↕</text>
        </g>
      ))}
    </PreviewSvg>
  ),

  openended: (
    <PreviewSvg>
      <rect x="3" y="3" width="234" height="28" rx="7" fill="white" stroke="#E0A13A" strokeWidth="1.4"/>
      <text x="14" y="20" fill="#91A0B1" fontSize="8.5" fontWeight="650" fontFamily="system-ui,sans-serif">Share your answer…</text>
      <rect x="83" y="10" width="1.5" height="12" rx="0.75" fill="#D88916"/>
      <rect x="3" y="38" width="234" height="13" rx="6.5" fill="#FFF9EF" stroke="#EED8AF" strokeWidth="1"/>
      <rect x="13" y="43" width="142" height="4" rx="2" fill="#D7AC68" fillOpacity="0.62"/>
      <rect x="3" y="56" width="174" height="13" rx="6.5" fill="#FFF9EF" stroke="#EED8AF" strokeWidth="1"/>
      <rect x="13" y="61" width="108" height="4" rx="2" fill="#D7AC68" fillOpacity="0.45"/>
    </PreviewSvg>
  ),

  wordcloud: (
    <PreviewSvg>
      <text x="120" y="38" textAnchor="middle" fill="#E66D36" fontSize="22" fontWeight="850" fontFamily="system-ui,sans-serif">curious</text>
      <text x="24" y="20" fill="#F09568" fontSize="12" fontWeight="800" fontFamily="system-ui,sans-serif">clear</text>
      <text x="184" y="18" fill="#D68352" fontSize="10" fontWeight="800" fontFamily="system-ui,sans-serif">useful</text>
      <text x="35" y="58" fill="#E38D57" fontSize="9" fontWeight="800" fontFamily="system-ui,sans-serif">fast</text>
      <text x="176" y="57" fill="#F0A26F" fontSize="14" fontWeight="850" fontFamily="system-ui,sans-serif">playful</text>
      <text x="117" y="66" fill="#C75D2E" fontSize="8" fontWeight="800" fontFamily="system-ui,sans-serif">bold</text>
      <text x="145" y="12" fill="#F6B18E" fontSize="7" fontWeight="800" fontFamily="system-ui,sans-serif">easy</text>
    </PreviewSvg>
  ),

  qa: (
    <PreviewSvg>
      <rect x="3" y="4" width="234" height="64" rx="8" fill="white" stroke="#91D1DF" strokeWidth="1.4"/>
      <rect x="13" y="14" width="38" height="44" rx="7" fill="#ECF9FC" stroke="#B2DFE8" strokeWidth="1.2"/>
      <path d="M26 31l6-6 6 6" fill="none" stroke="#188DAD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="32" y="46" textAnchor="middle" fill="#188DAD" fontSize="9" fontWeight="850" fontFamily="system-ui,sans-serif">18</text>
      <text x="63" y="29" fill="#31576B" fontSize="9.5" fontWeight="800" fontFamily="system-ui,sans-serif">Will the slides be shared?</text>
      <rect x="63" y="39" width="104" height="5" rx="2.5" fill="#A6CFD8"/>
      <rect x="63" y="49" width="72" height="5" rx="2.5" fill="#A6CFD8" fillOpacity="0.62"/>
    </PreviewSvg>
  ),

  case: (
    <PreviewSvg>
      <rect x="3" y="4" width="42" height="16" rx="5" fill="#FFE5EB"/>
      <text x="24" y="15" textAnchor="middle" fill="#B72F49" fontSize="7" fontWeight="900" fontFamily="system-ui,sans-serif">CASE</text>
      <rect x="53" y="7" width="181" height="5" rx="2.5" fill="#D9798D" fillOpacity="0.62"/>
      <rect x="53" y="16" width="146" height="5" rx="2.5" fill="#D9798D" fillOpacity="0.42"/>
      <text x="4" y="37" fill="#A73850" fontSize="8" fontWeight="850" fontFamily="system-ui,sans-serif">What would you do next?</text>
      {[3, 123].map(x => (
        <g key={x}>
          <rect x={x} y="45" width="114" height="22" rx="6" fill="white" stroke="#EBA3B2" strokeWidth="1.2"/>
          <circle cx={x + 12} cy="56" r="5" fill="white" stroke="#D77A8E" strokeWidth="1.3"/>
          <rect x={x + 23} y="53" width="62" height="5" rx="2.5" fill="#D77A8E" fillOpacity="0.42"/>
        </g>
      ))}
    </PreviewSvg>
  ),

  leaderboard: (
    <PreviewSvg>
      {[
        { y: 4, place: 1, score: '4,280', color: '#F0C64D', width: 136 },
        { y: 27, place: 2, score: '3,940', color: '#B9C1CE', width: 108 },
        { y: 50, place: 3, score: '3,720', color: '#D4A47B', width: 78 },
      ].map(row => (
        <g key={row.place}>
          <rect x="3" y={row.y} width="234" height="18" rx="6" fill={row.place === 1 ? '#FFFAE9' : 'white'} stroke={row.place === 1 ? '#E6C66D' : '#E5D8AF'} strokeWidth="1.2"/>
          <text x="14" y={row.y + 12} textAnchor="middle" fill="#8E691D" fontSize="8" fontWeight="900" fontFamily="system-ui,sans-serif">{row.place}</text>
          <circle cx="30" cy={row.y + 9} r="7" fill={row.color}/>
          <rect x="43" y={row.y + 6} width={row.width} height="5" rx="2.5" fill="#C9AA58" fillOpacity="0.7"/>
          <text x="229" y={row.y + 12} textAnchor="end" fill="#8E691D" fontSize="7.5" fontWeight="850" fontFamily="system-ui,sans-serif">{row.score}</text>
        </g>
      ))}
    </PreviewSvg>
  ),
}

export function getTypeIllustration(type: QuestionType): React.ReactNode {
  return ILLUSTRATIONS[type] ?? ILLUSTRATIONS.mcq ?? null
}
