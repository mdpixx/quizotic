// Trigger a browser download from a URL, surfacing API errors (e.g. the
// Pro-only 403 on export routes) instead of navigating to raw JSON.
export async function downloadFromUrl(url: string, filename: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      let message = `Download failed (${res.status})`
      try {
        const body = await res.json()
        if (body?.error) message = body.error
      } catch {
        // Not JSON — fall through to default message
      }
      return { ok: false, error: message }
    }
    const blob = await res.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(objectUrl)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
