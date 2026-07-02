/**
 * ai-quiz.ts
 *
 * Shared OpenRouter/OpenAI client and helpers for all quiz AI endpoints.
 * Extracted from generate-quiz/route.ts so the inline single-question and
 * options routes can reuse the same provider config without duplication.
 *
 * Server-side only — this module imports 'openai' which must not reach the client bundle.
 */

import OpenAI from 'openai'
import type { QuestionType } from './quiz-types'

// ── Provider ──────────────────────────────────────────────────────────────────

export const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

export const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-3-flash'

// Inject today's date so the model never gives stale "latest X" answers.
function getSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `Today's date is ${today}. For questions about 'latest', 'newest', or 'current' facts, use the most up-to-date information you know — do not present outdated facts as current. If unsure whether a fact is still current, prefer a timeless question.\n\nYou are a quiz generator. Return only valid JSON — no markdown, no explanation, no code fences.`
}

// ── Shared callModel ──────────────────────────────────────────────────────────

export async function callModel(prompt: string, modelOverride?: string): Promise<unknown> {
  const response = await client.chat.completions.create({
    model: modelOverride ?? MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: prompt },
    ],
  })
  const raw = response.choices[0]?.message?.content ?? ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

// ── Single-question prompt ────────────────────────────────────────────────────

export function buildSingleQuestionPrompt(type: QuestionType, context?: string): string {
  const contextLine = context ? `\nContext / topic: ${context}` : ''
  const typeGuide = TYPE_INSTRUCTIONS[type] ?? TYPE_INSTRUCTIONS['mcq']!

  return `Generate exactly 1 ${type} quiz question.${contextLine}

${typeGuide}

Rules:
- "timerSeconds" must be one of: 10, 15, 20, 30, 60
- "points" must be one of: 0, 500, 1000, 2000
- Return a single JSON object, not an array
- Never use placeholder text like "Option A"

Example:
${TYPE_EXAMPLES[type] ?? TYPE_EXAMPLES['mcq']}`
}

// ── Options-only prompt ───────────────────────────────────────────────────────

export function buildOptionsPrompt(questionText: string, type: QuestionType): string {
  if (type === 'truefalse') {
    return `For the true/false question: "${questionText}"

Return JSON: {"options":["True","False"],"correctAnswer":"0"} or {"options":["True","False"],"correctAnswer":"1"} depending on which is correct.`
  }

  if (type === 'multiselect') {
    return `Generate 4 answer options for this multi-select question: "${questionText}"

Return JSON: {"options":["...", "...", "...", "..."], "correctAnswers":["0","2"]}
- correctAnswers is an array of indices of the correct options
- At least one and no more than three options should be correct
- Never use placeholder text`
  }

  if (type === 'ranking') {
    return `Generate 4 items to rank for this question: "${questionText}"

Return JSON: {"options":["item1","item2","item3","item4"]}
- Each option is a meaningful, concrete item
- Do not include correctAnswer`
  }

  if (type === 'poll' || type === 'case') {
    return `Generate 4 compelling answer options for this ${type} question: "${questionText}"

Return JSON: ${type === 'case' ? '{"options":["...", "...", "...", "..."],"correctAnswer":"N"}' : '{"options":["...", "...", "...", "..."]}'}
- Each option must be complete and meaningful
- ${type === 'case' ? '"correctAnswer" is the string index of the best option' : 'No correctAnswer needed for poll'}`
  }

  // Default: MCQ
  return `Generate 4 answer options for this question: "${questionText}"

Return JSON: {"options":["...", "...", "...", "..."], "correctAnswer":"N"}
- "correctAnswer" is the string index ("0","1","2","3") of the ONE correct option
- The other 3 options must be plausible, close-match distractors: common misconceptions, near-correct values, or answers that sound right but are wrong — NOT obviously absurd
- All 4 options should be similar in length, style, and specificity
- Vary the correct answer position — do not always use index "0"
- Each option must be complete and meaningful, never a placeholder
- If the question has a well-known factual answer, make sure exactly one option IS correct`
}

// ── Type instructions / examples ──────────────────────────────────────────────

const TYPE_INSTRUCTIONS: Partial<Record<QuestionType, string>> = {
  mcq: 'Generate a classic multiple-choice question with exactly 4 options and one correct answer. "correctAnswer" is a string index ("0","1","2","3").',
  multiselect: 'Generate a multi-select question where multiple options can be correct. "correctAnswers" is an array of string indices.',
  truefalse: 'Generate a true/false question. options must be ["True","False"], "correctAnswer" is "0" or "1".',
  poll: 'Generate a poll question (no right answer). Include 4 opinion-based options, no "correctAnswer" field.',
  openended: 'Generate a thought-provoking open-ended question. No options, no correctAnswer.',
  wordcloud: 'Generate a word cloud question that invites short 1-3 word responses. No options, no correctAnswer.',
  qa: 'Generate a discussion Q&A question. No options, no correctAnswer.',
  rating: 'Generate a 1-5 star rating question. No options. Include "ratingLabel" field describing what is being rated.',
  ranking: 'Generate a ranking question with 4 items in "options" to rank. No correctAnswer.',
  case: 'Generate a scenario question with "scenarioText", 4 options, and "correctAnswer" index.',
}

const TYPE_EXAMPLES: Partial<Record<QuestionType, string>> = {
  mcq: `{"type":"mcq","text":"Which planet is closest to the Sun?","options":["Venus","Mercury","Mars","Earth"],"correctAnswer":"1","timerSeconds":20,"points":1000}`,
  multiselect: `{"type":"multiselect","text":"Which of these are programming languages?","options":["Python","HTML","Java","CSS"],"correctAnswers":["0","2"],"timerSeconds":30,"points":1000}`,
  truefalse: `{"type":"truefalse","text":"The Great Wall of China is visible from space.","options":["True","False"],"correctAnswer":"1","timerSeconds":15,"points":1000}`,
  poll: `{"type":"poll","text":"What is your preferred learning style?","options":["Visual","Hands-on","Reading","Listening"],"timerSeconds":20,"points":0}`,
  openended: `{"type":"openended","text":"Describe a challenge you faced recently and how you overcame it.","timerSeconds":60,"points":0}`,
  wordcloud: `{"type":"wordcloud","text":"What word best describes leadership to you?","timerSeconds":20,"points":0}`,
  qa: `{"type":"qa","text":"What questions do you have about today's session?","timerSeconds":60,"points":0}`,
  rating: `{"type":"rating","text":"How confident are you in applying today's learnings?","ratingLabel":"Confidence Level","timerSeconds":20,"points":0}`,
  ranking: `{"type":"ranking","text":"Rank these skills by importance in your role:","options":["Communication","Technical skills","Leadership","Problem solving"],"timerSeconds":30,"points":0}`,
  case: `{"type":"case","text":"What should the manager do first?","scenarioText":"A team member reports a data breach 30 minutes before a client presentation.","options":["Proceed with the presentation","Cancel the presentation","Notify the security team immediately","Inform the client right away"],"correctAnswer":"2","timerSeconds":30,"points":1000}`,
}
