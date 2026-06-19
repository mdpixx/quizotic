import { describe, expect, it, vi } from 'vitest'

import {
  clearPostHogToolbarState,
  preparePostHogDependencyScript,
} from '@/lib/posthog-toolbar-guard'

describe('PostHog toolbar guard', () => {
  it('blocks only the visual toolbar dependency', () => {
    const toolbarScript = {
      src: 'https://eu-assets.i.posthog.com/static/toolbar.js?v=1.364.7',
    } as HTMLScriptElement
    const recorderScript = {
      src: 'https://eu-assets.i.posthog.com/static/recorder.js?v=1.364.7',
    } as HTMLScriptElement

    expect(preparePostHogDependencyScript(toolbarScript)).toBeNull()
    expect(preparePostHogDependencyScript(recorderScript)).toBe(recorderScript)
  })

  it('clears persisted toolbar state without affecting other PostHog data', () => {
    const removeItem = vi.fn()

    clearPostHogToolbarState({ removeItem })

    expect(removeItem).toHaveBeenCalledOnce()
    expect(removeItem).toHaveBeenCalledWith('_postHogToolbarParams')
  })

  it('does not interrupt analytics initialization when storage is unavailable', () => {
    const storage = {
      removeItem: vi.fn(() => {
        throw new Error('Storage access denied')
      }),
    }

    expect(() => clearPostHogToolbarState(storage)).not.toThrow()
  })
})
