'use client'

/**
 * use-quiz-builder.ts
 *
 * Core state hook for the quiz builder. Wraps:
 *   - Quiz metadata (title, subject, theme)
 *   - Questions CRUD + reorder
 *   - Active question selection
 *   - Undo/redo (useHistory)
 *   - Autosave to localStorage draft (useAutosave)
 *   - Save to server (POST /api/quizzes)
 *   - Plan detection
 *
 * Used by the Slido-style builder (/host/build).
 * No rendering — pure state/effects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { useAutosave } from '@/lib/use-autosave'
import { useHistory } from '@/lib/use-history'
import { saveQuiz, loadQuizzes, setActiveSession } from '@/lib/quiz-storage'
import { draftKey, readDraft, writeDraft, clearDraft } from '@/lib/draft-storage'
import {
  validateQuizQuestions,
  hasQuizValidationErrors,
  formatQuizValidationIssues,
  makeQuestion,
  convertQuestionType,
  optionsForType,
  hydrateGeneratedQuestions,
} from '@/lib/quiz-builder-logic'
import type { Question, QuestionType, Quiz } from '@/lib/quiz-types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseQuizBuilderOptions {
  editId?: string | null
  initialType?: QuestionType | null
  initialTitle?: string
}

export interface UseQuizBuilderReturn {
  // Metadata
  title: string
  setTitle: (v: string) => void
  subject: string
  setSubject: (v: string) => void
  theme: string | undefined
  setTheme: (v: string | undefined) => void

  // Questions
  questions: Question[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  activeQuestion: Question | undefined

  // CRUD
  addQuestion: (type: QuestionType) => void
  duplicateQuestion: (index: number) => void
  removeQuestion: (index: number) => void
  removeQuestions: (indices: number[]) => void
  duplicateQuestions: (indices: number[]) => void
  reorderQuestions: (fromIndex: number, toIndex: number) => void
  updateQuestion: (index: number, partial: Partial<Question>) => void
  changeQuestionType: (index: number, type: QuestionType) => void
  applyGeneratedQuestions: (raw: Partial<Question>[]) => void

  // History
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  // Persistence
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  cloudSaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastCloudSaveAt: number | null
  handleSave: () => Promise<Quiz | null>
  handleStartLive: () => Promise<void>
  saving: boolean
  saveError: string
  savedQuiz: Quiz | null

  // Plan
  plan: 'free' | 'pro'
  quizId: string

  // Recovered draft info (show toast if set)
  recoveredDraft: { savedAt: number; quizId: string } | null
  dismissDraft: () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useQuizBuilder({
  editId,
  initialType,
  initialTitle = '',
}: UseQuizBuilderOptions = {}): UseQuizBuilderReturn {
  // Stable quiz id — pre-minted for new quizzes so draft key and server POST
  // always agree. Never re-mint after initialization (prevents duplicate rows).
  const quizIdRef = useRef<string>('')
  if (!quizIdRef.current) {
    quizIdRef.current = editId || crypto.randomUUID()
  }

  // ── Core state ─────────────────────────────────────────────────────────────

  const [title, setTitle] = useState(initialTitle)
  const [subject, setSubject] = useState('')
  const [theme, setTheme] = useState<string | undefined>(undefined)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedQuiz, setSavedQuiz] = useState<Quiz | null>(null)
  const [recoveredDraft, setRecoveredDraft] = useState<{ savedAt: number; quizId: string } | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [cloudSaveStatus, setCloudSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastCloudSaveAt, setLastCloudSaveAt] = useState<number | null>(null)

  const [questions, setQuestions] = useState<Question[]>(() => {
    const first = makeQuestion()
    if (!initialType) return [first]
    return [convertQuestionType(first, initialType)]
  })

  // ── Load existing quiz if editId provided ──────────────────────────────────

  useEffect(() => {
    if (!editId) return
    // Try server first, fallback to localStorage
    fetch(`/api/quizzes/${editId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const quiz = data?.data ?? loadQuizzes().find(q => q.id === editId)
        if (!quiz) return
        setTitle(quiz.title ?? '')
        setSubject(quiz.subject ?? '')
        setTheme(quiz.theme)
        if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
          setQuestions(quiz.questions)
          historyResetRef.current?.(
            { title: quiz.title ?? '', subject: quiz.subject ?? '', questions: quiz.questions, theme: quiz.theme }
          )
        }
        // Check for a newer draft
        const draft = readDraft<{ title: string; subject: string; questions: Question[] }>(
          draftKey('quiz', editId)
        )
        if (draft && draft.savedAt > (quiz.updatedAt ? new Date(quiz.updatedAt).getTime() : 0)) {
          setRecoveredDraft({ savedAt: draft.savedAt, quizId: editId })
        }
      })
      .catch(() => {
        const quiz = loadQuizzes().find(q => q.id === editId)
        if (!quiz) return
        setTitle(quiz.title ?? '')
        setSubject(quiz.subject ?? '')
        setTheme(quiz.theme)
        if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
          setQuestions(quiz.questions)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  // ── Plan detection ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/billing/status')
      .then(r => r.json())
      .then(d => { if (d.plan === 'pro') setPlan('pro') })
      .catch(() => {})
  }, [])

  // ── History (undo/redo) ────────────────────────────────────────────────────

  const historyValue = useMemo(
    () => ({ title, subject, questions, theme }),
    [title, subject, questions, theme],
  )

  const historyResetRef = useRef<((v: typeof historyValue) => void) | null>(null)

  const history = useHistory(historyValue, snap => {
    setTitle(snap.title)
    setSubject(snap.subject)
    setQuestions(snap.questions)
    setTheme(snap.theme)
  })

  // Keep historyResetRef in sync
  useEffect(() => {
    historyResetRef.current = history.reset
  }, [history.reset])

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, Ctrl/Cmd+S
  const handleSaveRef = useRef<(() => Promise<Quiz | null>) | null>(null)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); history.undo() }
      else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); history.redo() }
      else if (e.key === 's') { e.preventDefault(); handleSaveRef.current?.() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [history.undo, history.redo])

  // ── Autosave (draft → localStorage) ───────────────────────────────────────

  const { status: autosaveStatus } = useAutosave(
    { title, subject, questions },
    snap => {
      if (!quizIdRef.current) return false
      try {
        writeDraft(draftKey('quiz', quizIdRef.current), snap)
        return true
      } catch {
        return false
      }
    },
    { delayMs: 5000 },
  )

  // ── Server autosave (cloud) ────────────────────────────────────────────────
  // localStorage drafts only survive on this device/browser. A debounced
  // background POST to the same /api/quizzes upsert gives crash/tab-close
  // durability without delta complexity. 30s debounce + the no-change guard
  // stays well inside the 30 saves/min server rate limit.
  const cloudSaveInFlightRef = useRef(false)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (cloudSaveInFlightRef.current) return
      if (!title.trim() || questions.length === 0) return
      // Silent validation — autosave never surfaces errors mid-typing.
      if (hasQuizValidationErrors(validateQuizQuestions(questions))) return
      const snapshot = JSON.stringify({ title: title.trim(), subject: subject.trim(), questions })
      if (snapshot === lastSavedSnapshotRef.current) return

      cloudSaveInFlightRef.current = true
      setCloudSaveStatus('saving')
      try {
        const existing = editId ? loadQuizzes().find(q => q.id === editId) : null
        const res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: quizIdRef.current,
            title: title.trim(),
            subject: subject.trim() || undefined,
            language: existing?.language ?? 'English',
            theme: theme || existing?.theme,
            questions,
          }),
        })
        if (res.ok) {
          lastSavedSnapshotRef.current = JSON.stringify({
            title: title.trim(),
            subject: subject.trim() || '',
            questions,
          })
          setCloudSaveStatus('saved')
          setLastCloudSaveAt(Date.now())
        } else {
          setCloudSaveStatus('error')
        }
      } catch {
        setCloudSaveStatus('error')
      } finally {
        cloudSaveInFlightRef.current = false
      }
    }, 30_000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subject, questions, theme])

  // Warn on unsaved close
  const lastSavedSnapshotRef = useRef('')
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const current = JSON.stringify({ title, subject, questions })
      if (current !== lastSavedSnapshotRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [title, subject, questions])

  // ── Questions CRUD ─────────────────────────────────────────────────────────

  const addQuestion = useCallback((type: QuestionType) => {
    setQuestions(prev => {
      const q = makeQuestion({ type, options: optionsForType(type) })
      const next = [...prev, q]
      setActiveIndex(next.length - 1)
      return next
    })
  }, [])

  const duplicateQuestion = useCallback((index: number) => {
    setQuestions(prev => {
      const src = prev[index]
      if (!src) return prev
      const copy: Question = { ...src, id: crypto.randomUUID() }
      const next = [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]
      setActiveIndex(index + 1)
      return next
    })
  }, [])

  const removeQuestion = useCallback((index: number) => {
    setQuestions(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index)
      setActiveIndex(Math.min(index, next.length - 1))
      return next
    })
  }, [])

  // Bulk variants for the multi-select toolbar in QuestionList. Always keeps
  // at least one question, mirroring removeQuestion's guard.
  const removeQuestions = useCallback((indices: number[]) => {
    setQuestions(prev => {
      const drop = new Set(indices)
      const next = prev.filter((_, i) => !drop.has(i))
      if (next.length === 0) return prev
      setActiveIndex(i => Math.min(i, next.length - 1))
      return next
    })
  }, [])

  const duplicateQuestions = useCallback((indices: number[]) => {
    setQuestions(prev => {
      const picked = new Set(indices)
      const next: Question[] = []
      prev.forEach((q, i) => {
        next.push(q)
        if (picked.has(i)) next.push({ ...q, id: crypto.randomUUID() })
      })
      return next
    })
  }, [])

  const reorderQuestions = useCallback((fromIndex: number, toIndex: number) => {
    setQuestions(prev => {
      const next = arrayMove(prev, fromIndex, toIndex)
      setActiveIndex(toIndex)
      return next
    })
  }, [])

  const updateQuestion = useCallback((index: number, partial: Partial<Question>) => {
    setQuestions(prev => {
      if (!prev[index]) return prev
      const next = [...prev]
      next[index] = { ...prev[index], ...partial }
      return next
    })
  }, [])

  const changeQuestionType = useCallback((index: number, type: QuestionType) => {
    setQuestions(prev => {
      if (!prev[index]) return prev
      const next = [...prev]
      next[index] = convertQuestionType(prev[index], type)
      return next
    })
  }, [])

  const applyGeneratedQuestions = useCallback((raw: Partial<Question>[]) => {
    const hydrated = hydrateGeneratedQuestions(raw)
    setQuestions(hydrated)
    setActiveIndex(0)
  }, [])

  // ── Save helpers ───────────────────────────────────────────────────────────

  function showSaveError(msg: string) {
    setSaveError(msg)
    setTimeout(() => setSaveError(''), 4000)
  }

  const handleSave = useCallback(async (): Promise<Quiz | null> => {
    if (!title.trim()) { showSaveError('Quiz title is required'); return null }
    if (questions.length === 0) { showSaveError('Add at least one question'); return null }

    const issues = validateQuizQuestions(questions)
    if (hasQuizValidationErrors(issues)) {
      const first = issues[0]
      if (first) setActiveIndex(first.questionIndex)
      showSaveError(formatQuizValidationIssues(issues))
      return null
    }

    setSaveError('')
    setSaving(true)

    const now = new Date().toISOString()
    const existing = editId ? loadQuizzes().find(q => q.id === editId) : null
    const stableId = editId ?? quizIdRef.current
    const quizData = {
      id: stableId,
      title: title.trim(),
      subject: subject.trim() || undefined,
      language: existing?.language ?? 'English',
      theme: theme || existing?.theme,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      questions,
    }

    saveQuiz(quizData)
    let finalQuiz = quizData as Quiz
    let dbSaveFailed = false
    let dbSaveError = ''

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quizData.id,
          title: quizData.title,
          subject: quizData.subject,
          language: quizData.language,
          theme: quizData.theme,
          questions: quizData.questions,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data?.id) {
          finalQuiz = { ...quizData, id: data.id, updatedAt: data.updatedAt ?? quizData.updatedAt } as Quiz
          saveQuiz(finalQuiz)
        }
      } else {
        dbSaveFailed = true
        try {
          const payload = await res.json()
          dbSaveError = Array.isArray(payload?.issues)
            ? formatQuizValidationIssues(payload.issues)
            : payload?.error ?? `Server returned ${res.status}`
        } catch {
          dbSaveError = `Server returned ${res.status}`
        }
      }
    } catch (err) {
      dbSaveFailed = true
      dbSaveError = err instanceof Error ? err.message : 'Network error'
    }

    if (dbSaveFailed) {
      showSaveError(`Couldn't save to server: ${dbSaveError}. Quiz kept locally — try Save again.`)
    }

    clearDraft(draftKey('quiz', finalQuiz.id))
    quizIdRef.current = finalQuiz.id
    setRecoveredDraft(null)
    lastSavedSnapshotRef.current = JSON.stringify({
      title: quizData.title,
      subject: quizData.subject ?? '',
      questions: quizData.questions,
    })

    setSaving(false)
    setSavedQuiz(finalQuiz)
    if (!dbSaveFailed) {
      setCloudSaveStatus('saved')
      setLastCloudSaveAt(Date.now())
    }
    return dbSaveFailed ? null : finalQuiz
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subject, questions, theme, editId])

  // Keep the Cmd/Ctrl+S shortcut pointing at the freshest save closure.
  useEffect(() => { handleSaveRef.current = handleSave }, [handleSave])

  const handleStartLive = useCallback(async () => {
    const quiz = savedQuiz ?? await handleSave()
    if (!quiz) return
    setActiveSession(quiz)
    window.location.href = '/host/session'
  }, [savedQuiz, handleSave])

  const dismissDraft = useCallback(() => setRecoveredDraft(null), [])

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    title,
    setTitle,
    subject,
    setSubject,
    theme,
    setTheme,
    questions,
    activeIndex,
    setActiveIndex,
    activeQuestion: questions[activeIndex],
    addQuestion,
    duplicateQuestion,
    removeQuestion,
    removeQuestions,
    duplicateQuestions,
    reorderQuestions,
    updateQuestion,
    changeQuestionType,
    applyGeneratedQuestions,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    autosaveStatus,
    cloudSaveStatus,
    lastCloudSaveAt,
    handleSave,
    handleStartLive,
    saving,
    saveError,
    savedQuiz,
    plan,
    quizId: quizIdRef.current,
    recoveredDraft,
    dismissDraft,
  }
}
