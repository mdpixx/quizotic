// Quiet hours. Design spec §5, guard 7: lifecycle mail only leaves between
// 09:00 and 19:00 in the recipient's local time. No 3am mail.
//
// We have no timezone field — only User.country (ISO 3166-1 alpha-2) and
// User.locale, both captured from request headers at first sign-in. So the
// zone is inferred, and the inference is deliberately coarse.
//
// That is fine, and here is why: the window is ten hours wide. Being wrong by
// two or three hours inside a large country still lands the send in daylight.
// The failure this guard exists to prevent is a 3am email, not a 10:15am one.
// Countries spanning many zones are mapped to their most populous zone for
// exactly that reason.
//
// No new dependency: Intl carries the full IANA database, including DST
// transitions, so the only thing we hand-maintain is country → zone.
// (Intl.Locale.prototype.getTimeZones would do this for us, but it is not
// implemented in Node 22, which is what Railway runs.)

/** Send window, inclusive of the start hour and exclusive of the end. */
export const QUIET_HOURS = { startHour: 9, endHour: 19 } as const

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

// Countries we actually see traffic from, plus the large English-speaking
// markets. Anything unmapped falls back to IST, per spec.
const COUNTRY_TIMEZONE: Record<string, string> = {
  IN: 'Asia/Kolkata',
  LK: 'Asia/Colombo',
  BD: 'Asia/Dhaka',
  NP: 'Asia/Kathmandu',
  PK: 'Asia/Karachi',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  ID: 'Asia/Jakarta',
  PH: 'Asia/Manila',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  // Multi-zone countries → most populous zone. See the note above.
  US: 'America/New_York',
  CA: 'America/Toronto',
  BR: 'America/Sao_Paulo',
  AU: 'Australia/Sydney',
  RU: 'Europe/Moscow',
  MX: 'America/Mexico_City',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  PL: 'Europe/Warsaw',
  SE: 'Europe/Stockholm',
  TR: 'Europe/Istanbul',
  NZ: 'Pacific/Auckland',
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi',
  EG: 'Africa/Cairo',
  GH: 'Africa/Accra',
}

/**
 * Best-effort IANA zone for a user. `country` wins; `locale` is only consulted
 * for its region subtag, since a locale like "en-US" carries a region but
 * "en" does not.
 */
export function timezoneFor(country?: string | null, locale?: string | null): string {
  const fromCountry = country && COUNTRY_TIMEZONE[country.trim().toUpperCase()]
  if (fromCountry) return fromCountry

  const region = locale?.split(/[-_]/)[1]
  const fromLocale = region && COUNTRY_TIMEZONE[region.trim().toUpperCase()]
  if (fromLocale) return fromLocale

  return DEFAULT_TIMEZONE
}

// en-GB with hour12:false yields h23, so midnight formats as "00" rather than
// the "24" some locales produce.
function formatHour(timeZone: string, at: Date): number {
  return Number.parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hour12: false }).format(at),
    10,
  )
}

/** Local wall-clock hour (0–23) in `timeZone` at instant `at`. */
export function localHourIn(timeZone: string, at: Date): number {
  try {
    return formatHour(timeZone, at)
  } catch {
    // An unknown zone would otherwise throw and take the whole tick down.
    // Deferring to the default is safe: at worst a send waits an hour and the
    // next run retries. Not recursive — a second failure means Intl itself is
    // broken, and blocking the send is the right answer then.
    try {
      return formatHour(DEFAULT_TIMEZONE, at)
    } catch {
      return -1
    }
  }
}

export function isWithinSendWindow(
  at: Date,
  country?: string | null,
  locale?: string | null,
): boolean {
  const hour = localHourIn(timezoneFor(country, locale), at)
  return hour >= QUIET_HOURS.startHour && hour < QUIET_HOURS.endHour
}
