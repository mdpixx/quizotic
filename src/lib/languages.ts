// Canonical language list for the quiz builder's "Language" dropdowns.
//
// Ordering policy: English first (the default), then strictly alphabetical.
// The set leans global — major world languages by speaker count/usage — so the
// picker doesn't read as region-specific to any one audience.
//
// The selected value is only ever sent to the AI as a plain string
// ("generate in {language}"), so entries are safe to add/rename freely.
export const QUIZ_LANGUAGES: string[] = [
  'English',
  'Arabic',
  'Bengali',
  'Chinese (Mandarin)',
  'Dutch',
  'Filipino',
  'French',
  'German',
  'Greek',
  'Hebrew',
  'Hindi',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Marathi',
  'Persian',
  'Polish',
  'Portuguese',
  'Russian',
  'Spanish',
  'Swahili',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Urdu',
  'Vietnamese',
]
