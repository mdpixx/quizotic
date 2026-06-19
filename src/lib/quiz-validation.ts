import { getOptionText, type Question, type QuestionOption } from './quiz-types'

export type QuizValidationSeverity = 'error' | 'warning'

export interface QuizValidationIssue {
  questionIndex: number
  field: string
  message: string
  severity: QuizValidationSeverity
}

function optionText(opt: QuestionOption | unknown): string {
  if (typeof opt === 'string') return opt
  if (opt && typeof opt === 'object' && 'text' in opt) {
    return String((opt as { text?: unknown }).text ?? '')
  }
  return ''
}

function cleanOptions(q: Pick<Question, 'type' | 'options'>): string[] {
  if (q.type === 'truefalse') return ['True', 'False']
  return (q.options ?? []).map(optionText)
}

function hasUsableOptions(q: Pick<Question, 'type' | 'options'>): boolean {
  if (q.type === 'truefalse') return true
  return cleanOptions(q).filter(text => text.trim()).length >= 2
}

function parseOptionIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isInteger(n) ? n : null
  }
  return null
}

function isValidOptionIndex(value: unknown, optionCount: number): boolean {
  const n = parseOptionIndex(value)
  return n !== null && n >= 0 && n < optionCount
}

export function validateQuizQuestions(questions: Question[]): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = []

  questions.forEach((q, questionIndex) => {
    const type = q.type
    const options = cleanOptions(q)
    const optionCount = options.length

    if (!q.text?.trim()) {
      issues.push({
        questionIndex,
        field: 'text',
        message: 'Question text is required.',
        severity: 'error',
      })
    }

    if ((type === 'mcq' || type === 'multiselect' || type === 'poll' || type === 'case') && !hasUsableOptions(q)) {
      issues.push({
        questionIndex,
        field: 'options',
        message: `${type === 'multiselect' ? 'Multi-select' : type === 'mcq' ? 'MCQ' : 'Option'} questions need at least two answer options.`,
        severity: 'error',
      })
    }

    if (type === 'mcq' || type === 'truefalse') {
      if (q.correctAnswer === undefined || q.correctAnswer === '') {
        issues.push({
          questionIndex,
          field: 'correctAnswer',
          message: `${type === 'mcq' ? 'MCQ' : 'True/False'} questions need one correct answer.`,
          severity: 'error',
        })
      } else if (!isValidOptionIndex(q.correctAnswer, optionCount)) {
        issues.push({
          questionIndex,
          field: 'correctAnswer',
          message: `${type === 'mcq' ? 'MCQ' : 'True/False'} correct answer must match an existing option.`,
          severity: 'error',
        })
      }
    }

    if (type === 'multiselect') {
      const correctAnswers = Array.isArray(q.correctAnswers)
        ? q.correctAnswers
        : Array.isArray(q.correctAnswer)
          ? q.correctAnswer
          : []
      const unique = [...new Set(correctAnswers.map(String).filter(Boolean))]
      if (unique.length === 0) {
        issues.push({
          questionIndex,
          field: 'correctAnswers',
          message: 'Multi-select questions need at least one correct option.',
          severity: 'error',
        })
      } else if (unique.some(answer => !isValidOptionIndex(answer, optionCount))) {
        issues.push({
          questionIndex,
          field: 'correctAnswers',
          message: 'Multi-select correct answers must match existing options.',
          severity: 'error',
        })
      }
    }

    if ((type === 'mcq' || type === 'multiselect' || type === 'poll' || type === 'case') && q.options?.some(opt => !getOptionText(opt).trim())) {
      issues.push({
        questionIndex,
        field: 'options',
        message: 'All answer options must have text.',
        severity: 'error',
      })
    }

    if (type === 'fillblank') {
      const accepted = (q.blankAnswers ?? []).filter(a => a.trim() !== '')
      if (accepted.length === 0) {
        issues.push({
          questionIndex,
          field: 'blankAnswers',
          message: 'Fill-in-the-blank questions need at least one accepted answer.',
          severity: 'error',
        })
      }
    }

    if (type === 'matching') {
      const pairs = (q.matchPairs ?? []).filter(p => p.left.trim() !== '' && p.right.trim() !== '')
      if (pairs.length < 2) {
        issues.push({
          questionIndex,
          field: 'matchPairs',
          message: 'Matching questions need at least two complete pairs.',
          severity: 'error',
        })
      }
    }

    if ((type === 'mcq' || type === 'multiselect' || type === 'poll' || type === 'case') && q.options?.some(opt => getOptionText(opt).length > 150)) {
      issues.push({
        questionIndex,
        field: 'options',
        message: 'Answer options should be 150 characters or fewer.',
        severity: 'warning',
      })
    }
  })

  return issues
}

export function hasQuizValidationErrors(issues: QuizValidationIssue[]): boolean {
  return issues.some(issue => issue.severity === 'error')
}

export function formatQuizValidationIssues(issues: QuizValidationIssue[]): string {
  return issues.map(issue => `Q${issue.questionIndex + 1}: ${issue.message}`).join(' ')
}
