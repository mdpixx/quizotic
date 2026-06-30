const POSTHOG_TOOLBAR_STORAGE_KEY = '_postHogToolbarParams'

type ToolbarStorage = Pick<Storage, 'removeItem'>

export function preparePostHogDependencyScript(
  script: HTMLScriptElement,
): HTMLScriptElement | null {
  try {
    const path = new URL(script.src, 'https://quizotic.live').pathname
    // Match both the direct assets host (/static/toolbar.js) and the reverse-
    // proxied path (/ingest/static/toolbar.js) — see next.config.ts rewrites.
    return path.endsWith('/static/toolbar.js') ? null : script
  } catch {
    return script
  }
}

export function clearPostHogToolbarState(storage?: ToolbarStorage): void {
  try {
    const toolbarStorage = storage ?? window.localStorage
    toolbarStorage.removeItem(POSTHOG_TOOLBAR_STORAGE_KEY)
  } catch {
    // Analytics must never affect the user experience when storage is blocked.
  }
}
