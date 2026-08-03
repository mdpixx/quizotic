// Participant identity tests.
//
// Three separate host complaints converge on one root cause — the join screen's
// free-text display name was doing the work of a real identifier:
//   1. "12345" was an acceptable name, so the report was unreadable.
//   2. Two students named "Rahul" could not be told apart.
//   3. Worse: one Rahul could silently inherit the other's score on reconnect.
//
// These lock all three shut, plus the open-ended input constraints that let a
// host collect a clean roll number instead of reconciling free text by hand.

import { describe, expect, it } from 'vitest'
import {
  validateParticipantName,
  isValidParticipantName,
  MAX_NAME_LENGTH,
} from '../lib/participant-name.mjs'
import {
  findDisconnectedEntry,
  rememberDisconnected,
  forgetDisconnected,
  disambiguateName,
  disconnectKeyFor,
} from '../lib/session-state.mjs'
import {
  validateOpenEndedAnswer,
  filterToMode,
  inputHintFor,
  isNameCaptureQuestion,
  buildNameCaptureQuestion,
} from '../lib/openended-input.mjs'

// ─── Name validation ─────────────────────────────────────────────────────────

describe('validateParticipantName', () => {
  it('rejects the letter-free names this feature exists for', () => {
    for (const bad of ['12345', '42', '...', '   ', '', '#$%', '1']) {
      expect(validateParticipantName(bad).ok).toBe(false)
    }
  })

  it('accepts Latin names', () => {
    expect(validateParticipantName('Rahul').ok).toBe(true)
    expect(validateParticipantName('  Anu  ').ok).toBe(true)
  })

  it('trims to the typed name', () => {
    const r = validateParticipantName('  Rahul  ')
    expect(r.ok && r.name).toBe('Rahul')
  })

  // The single most important case for an India-first product: a naive
  // /[a-zA-Z]/ check would have locked out most of the target market.
  it('accepts non-Latin scripts', () => {
    for (const name of ['राहुल', 'ரமேஷ்', 'রাহুল', 'ಪ್ರಿಯಾ', 'ప్రియ', 'પ્રિયા', '李雷']) {
      expect(isValidParticipantName(name)).toBe(true)
    }
  })

  it('allows digits inside a real name', () => {
    expect(isValidParticipantName('Rahul 42')).toBe(true)
    expect(isValidParticipantName('Batch3 Anu')).toBe(true)
  })

  it('rejects over-length names', () => {
    expect(validateParticipantName('a'.repeat(MAX_NAME_LENGTH + 1)).ok).toBe(false)
  })

  it('returns actionable copy, not "invalid"', () => {
    const r = validateParticipantName('12345')
    if (r.ok) throw new Error('expected "12345" to be rejected')
    expect(r.error).toMatch(/letters/i)
  })
})

// ─── Duplicate names ─────────────────────────────────────────────────────────

type P = { participantId: string; name: string; realName?: string; score?: number }

function makeSession(participants: P[] = []) {
  const byId = new Map<string, P>()
  const bySocket = new Map<string, P>()
  participants.forEach((p, i) => {
    byId.set(p.participantId, p)
    bySocket.set(`sock-${i}`, p)
  })
  return {
    participants: bySocket,
    participantsById: byId,
    disconnectedParticipants: new Map(),
  }
}

describe('disambiguateName', () => {
  it('leaves a unique name untouched', () => {
    const s = makeSession([{ participantId: 'a', name: 'Anu', realName: 'Anu' }])
    expect(disambiguateName(s, 'Rahul')).toBe('Rahul')
  })

  it('suffixes a colliding name rather than rejecting it', () => {
    const s = makeSession([{ participantId: 'a', name: 'Rahul', realName: 'Rahul' }])
    expect(disambiguateName(s, 'Rahul')).toBe('Rahul (2)')
  })

  it('keeps counting past the first collision', () => {
    const s = makeSession([
      { participantId: 'a', name: 'Rahul', realName: 'Rahul' },
      { participantId: 'b', name: 'Rahul (2)', realName: 'Rahul (2)' },
    ])
    expect(disambiguateName(s, 'Rahul')).toBe('Rahul (3)')
  })

  it('is case-insensitive', () => {
    const s = makeSession([{ participantId: 'a', name: 'rahul', realName: 'rahul' }])
    expect(disambiguateName(s, 'RAHUL')).toBe('RAHUL (2)')
  })

  // Anonymous mode puts the archetype in `name`, so comparing `name` alone
  // would find no collisions and every participant would keep a bare name.
  it('compares against realName in anonymous mode', () => {
    const s = makeSession([{ participantId: 'a', name: 'Cyan Falcon', realName: 'Rahul' }])
    expect(disambiguateName(s, 'Rahul')).toBe('Rahul (2)')
  })
})

// ─── Reconnect: the score-transplant bug ─────────────────────────────────────

describe('disconnect map keying', () => {
  it('keys on participantId so two same-named participants both survive', () => {
    const a = { participantId: 'pid-a', name: 'Rahul', realName: 'Rahul', score: 900 }
    const b = { participantId: 'pid-b', name: 'Rahul', realName: 'Rahul', score: 100 }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    rememberDisconnected(s, { participant: b, socketId: 's2', gameCode: '123456' })
    // Under the old name key the second write evicted the first outright.
    expect(s.disconnectedParticipants.size).toBe(2)
    expect(disconnectKeyFor(a)).not.toBe(disconnectKeyFor(b))
  })

  it('forgetDisconnected clears only the matching participant', () => {
    const a = { participantId: 'pid-a', name: 'Rahul', realName: 'Rahul' }
    const b = { participantId: 'pid-b', name: 'Rahul', realName: 'Rahul' }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    rememberDisconnected(s, { participant: b, socketId: 's2', gameCode: '123456' })
    forgetDisconnected(s, a)
    expect(s.disconnectedParticipants.size).toBe(1)
    expect([...s.disconnectedParticipants.values()][0].participant.participantId).toBe('pid-b')
  })
})

describe('findDisconnectedEntry', () => {
  it('matches on participantId', () => {
    const a = { participantId: 'pid-a', name: 'Rahul', realName: 'Rahul' }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    const found = findDisconnectedEntry(s, { participantId: 'pid-a', displayName: 'Rahul' })
    expect(found?.entry.participant.participantId).toBe('pid-a')
  })

  // THE regression this whole change exists to prevent: a different device with
  // a different participantId, joining under a name that happens to match.
  it('never falls back to a name match when a participantId was presented', () => {
    const a = { participantId: 'pid-a', name: 'Rahul', realName: 'Rahul', score: 5000 }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    const found = findDisconnectedEntry(s, { participantId: 'pid-NEW', displayName: 'Rahul' })
    expect(found).toBeNull()
  })

  it('refuses an ambiguous name match', () => {
    const a = { participantId: 'pid-a', name: 'Rahul', realName: 'Rahul' }
    const b = { participantId: 'pid-b', name: 'Rahul', realName: 'Rahul' }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    rememberDisconnected(s, { participant: b, socketId: 's2', gameCode: '123456' })
    expect(findDisconnectedEntry(s, { participantId: undefined, displayName: 'Rahul' })).toBeNull()
  })

  it('still recovers a legacy single-match name', () => {
    const a = { participantId: 'pid-a', name: 'Alice', realName: 'Alice' }
    const s = makeSession()
    rememberDisconnected(s, { participant: a, socketId: 's1', gameCode: '123456' })
    const found = findDisconnectedEntry(s, { participantId: undefined, displayName: 'alice' })
    expect(found?.entry.participant.participantId).toBe('pid-a')
  })
})

// ─── Open-ended input constraints ────────────────────────────────────────────

describe('validateOpenEndedAnswer', () => {
  it('is permissive when the host set no constraint', () => {
    expect(validateOpenEndedAnswer('anything at all 42!', {}).ok).toBe(true)
  })

  it('enforces numbers-only', () => {
    const q = { inputMode: 'number' }
    expect(validateOpenEndedAnswer('4212', q).ok).toBe(true)
    expect(validateOpenEndedAnswer('Roll 42', q).ok).toBe(false)
  })

  it('enforces an exact length', () => {
    const q = { inputMode: 'number', lengthMode: 'exact', exactLength: 6 }
    expect(validateOpenEndedAnswer('123456', q).ok).toBe(true)
    expect(validateOpenEndedAnswer('12345', q).ok).toBe(false)
    expect(validateOpenEndedAnswer('1234567', q).ok).toBe(false)
  })

  it('enforces letters-only without blocking non-Latin scripts', () => {
    const q = { inputMode: 'text' }
    expect(validateOpenEndedAnswer('Rahul Sharma', q).ok).toBe(true)
    expect(validateOpenEndedAnswer('राहुल शर्मा', q).ok).toBe(true)
    expect(validateOpenEndedAnswer('Rahul 42', q).ok).toBe(false)
  })

  it('uppercases when asked, so emp123 and EMP123 land as one value', () => {
    const q = { inputMode: 'alphanumeric', transform: 'uppercase' }
    const a = validateOpenEndedAnswer('emp123', q)
    const b = validateOpenEndedAnswer('EMP123', q)
    expect(a.ok && a.value).toBe('EMP123')
    expect(b.ok && b.value).toBe('EMP123')
  })

  it('rejects an empty answer', () => {
    expect(validateOpenEndedAnswer('   ', { inputMode: 'number' }).ok).toBe(false)
  })

  it('ignores a corrupted exactLength instead of blocking every answer', () => {
    expect(validateOpenEndedAnswer('42', { lengthMode: 'exact', exactLength: 0 }).ok).toBe(true)
    expect(validateOpenEndedAnswer('42', { lengthMode: 'exact', exactLength: 9999 }).ok).toBe(true)
  })
})

describe('filterToMode', () => {
  it('strips disallowed characters as the participant types', () => {
    expect(filterToMode('Roll 42', { inputMode: 'number' })).toBe('42')
    expect(filterToMode('a1!b2', { inputMode: 'text' })).toBe('ab')
  })

  it('clamps to the fixed length', () => {
    expect(filterToMode('1234567890', { inputMode: 'number', lengthMode: 'exact', exactLength: 6 })).toBe('123456')
  })

  it('leaves free text alone', () => {
    expect(filterToMode('Anything! 42', {})).toBe('Anything! 42')
  })
})

describe('inputHintFor', () => {
  it('describes the constraint to the participant', () => {
    expect(inputHintFor({ inputMode: 'number', lengthMode: 'exact', exactLength: 6 })).toBe('6 digits')
    expect(inputHintFor({ inputMode: 'text' })).toBe('Letters only')
    expect(inputHintFor({})).toBeNull()
  })
})

// ─── Name-capture detection (incl. retroactive) ──────────────────────────────

describe('isNameCaptureQuestion', () => {
  it('honours the explicit flag at any position', () => {
    expect(isNameCaptureQuestion({ type: 'openended', text: 'Anything', isNameCapture: true }, 4)).toBe(true)
  })

  // This is what gives already-conducted sessions the new report treatment
  // without the host re-running anything.
  it('detects a first-slide identity question retroactively', () => {
    expect(isNameCaptureQuestion({ type: 'openended', text: 'Enter your full name' }, 0)).toBe(true)
    expect(isNameCaptureQuestion({ type: 'openended', text: 'Your roll number?' }, 0)).toBe(true)
    expect(isNameCaptureQuestion({ type: 'openended', text: 'Employee code' }, 0)).toBe(true)
    expect(isNameCaptureQuestion({ type: 'openended', text: 'अपना नाम लिखें' }, 0)).toBe(true)
  })

  it('does not fire on a mid-quiz question that merely mentions a name', () => {
    expect(isNameCaptureQuestion({ type: 'openended', text: 'What is your name' }, 3)).toBe(false)
  })

  it('does not fire on non-openended slides', () => {
    expect(isNameCaptureQuestion({ type: 'mcq', text: 'Enter your full name' }, 0)).toBe(false)
  })

  it('does not fire on an unrelated first question', () => {
    expect(isNameCaptureQuestion({ type: 'openended', text: 'What did you learn today?' }, 0)).toBe(false)
  })
})

describe('buildNameCaptureQuestion', () => {
  it('produces a slide that its own detector recognises', () => {
    const q = buildNameCaptureQuestion('id-1')
    expect(q.type).toBe('openended')
    expect(q.inputMode).toBe('text')
    expect(isNameCaptureQuestion(q, 0)).toBe(true)
  })
})
