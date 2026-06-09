/**
 * SparkleIcon — multi-star AI sparkle icon.
 *
 * Three 4-pointed stars (one large, one medium, one small) matching the
 * Google AI / Gemini-style sparkle reference. Used on all AI-related buttons
 * across the quiz builder.
 */

export function SparkleIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      {/* Large 4-pointed star — centre-left */}
      <path d="M7 1 L8 5.5 L12.5 6.5 L8 7.5 L7 12 L6 7.5 L1.5 6.5 L6 5.5 Z" />
      {/* Medium 4-pointed star — top-right */}
      <path d="M15 1.5 L15.7 3.8 L18 4.5 L15.7 5.2 L15 7.5 L14.3 5.2 L12 4.5 L14.3 3.8 Z" />
      {/* Small 4-pointed star — bottom-right */}
      <path d="M16.5 12 L17 13.5 L18.5 14 L17 14.5 L16.5 16 L16 14.5 L14.5 14 L16 13.5 Z" />
    </svg>
  )
}
