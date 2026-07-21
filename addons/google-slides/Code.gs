/**
 * Quizotic for Google Slides — add-on entry point.
 *
 * Polling-only (Apps Script sandbox can't speak Socket.IO). Talks to the
 * Quizotic HTTP control surface added in this branch:
 *   - POST   /api/v1/sessions/create           — mint a live session
 *   - GET    /api/v1/sessions/:code/snapshot   — read phase / question / counts
 *   - POST   /api/v1/sessions/:code/control    — drive (start / next / end ...)
 *
 * Auth: the host pastes their Quizotic API key (issued at
 * quizotic.live/host/settings) into the sidebar; it's stored in
 * PropertiesService (per-user script properties) and sent as a Bearer token
 * on every fetch.
 *
 * UX limitation (honest, documented in marketing copy): Google Slides has no
 * "slideshow active" hook the way Office does, so the live-results view is
 * delivered through a manually-advanced sidebar that polls the snapshot
 * endpoint every ~2s. It is NOT a seamless on-slide live view like the Office
 * add-in offers. The on-slide placeholder image carries the QR + game code so
 * the audience joins from their phones regardless.
 */

const BASE_URL = 'https://www.quizotic.live'

/**
 * Built-in menu — runs when the Slides editor opens with the add-on installed.
 */
function onOpen() {
  SlidesApp.getUi()
    .createMenu('Quizotic')
    .addItem('Open sidebar', 'showSidebar')
    .addToUi()
}

/**
 * Launch the primary sidebar (the host control surface).
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Quizotic')
    .setWidth(340)
  SlidesApp.getUi().showSidebar(html)
}

// ─── RPC entrypoints (called via google.script.run from the sidebar HTML) ──

/**
 * Returns { connected, hasQuiz, apiKeyMasked } so the sidebar can render the
 * right step on load. Never returns the raw key to the client.
 */
function getConnectState() {
  const apiKey = getApiKey()
  return {
    connected: !!apiKey,
    apiKeyMasked: apiKey ? maskKey(apiKey) : null,
  }
}

/**
 * Verify and store an API key. Calls the (cheap, cached) quiz-list endpoint to
 * confirm the key is valid before persisting. Returns { ok, error? }.
 */
function connectAccount(rawKey) {
  const key = String(rawKey || '').trim()
  if (!key.startsWith('qz_')) {
    return { ok: false, error: 'API keys start with "qz_" — check quizotic.live/host/settings.' }
  }
  // Validate the key by issuing a tiny read against the v1 API.
  const check = quizoticFetch_('/api/v1/quizzes?limit=1', { method: 'get' }, key)
  if (check.status !== 200) {
    return { ok: false, error: 'Could not verify that API key (status ' + check.status + ').' }
  }
  setApiKey(key)
  return { ok: true }
}

function disconnectAccount() {
  PropertiesService.getUserProperties().deleteProperty('quizotic_api_key')
  return { ok: true }
}

/**
 * List the host's quizzes for the picker. Returns { quizzes: [{id, title}] }
 * or { error }.
 */
function listQuizzes() {
  if (!getApiKey()) return { error: 'Connect your account first.' }
  const res = quizoticFetch_('/api/v1/quizzes?limit=50', { method: 'get' })
  if (res.status !== 200) return { error: 'Failed to load quizzes (' + res.status + ').' }
  const body = JSON.parse(res.getContentText())
  return { quizzes: (body.data || []).map(function (q) { return { id: q.id, title: q.title } }) }
}

/**
 * Start a live session from a quiz id AND drop a placeholder image with the QR
 * + game code onto the current slide. Returns { ok, gameCode, joinUrl } or
 * { error }.
 */
function startSession(quizId) {
  if (!quizId) return { error: 'Pick a quiz first.' }
  const res = quizoticFetch_('/api/v1/sessions/create', {
    method: 'post',
    payload: JSON.stringify({ quizId: quizId }),
    contentType: 'application/json',
  })
  if (res.status !== 201) {
    return { error: 'Failed to start session (' + res.status + '): ' + res.getContentText() }
  }
  const body = JSON.parse(res.getContentText())
  const data = body.data
  // Drop a placeholder onto the current slide so the audience sees the join
  // code + QR even before the host opens the live sidebar.
  try {
    insertPlaceholderSlide_(data.gameCode, data.joinUrl)
  } catch (e) {
    // Non-fatal — the session is live, the host just didn't get a slide
    // placeholder (e.g. no edit scope, or a read-only deck).
    console.warn('placeholder insert failed: ' + e.message)
  }
  PropertiesService.getUserProperties().setProperty('quizotic_active_code', data.gameCode)
  return { ok: true, gameCode: data.gameCode, joinUrl: data.joinUrl }
}

/**
 * Drive the active session. action is one of: start, next, end_question,
 * show_standings, end. Returns { ok, snapshot?, error? }.
 */
function controlSession(action) {
  const code = PropertiesService.getUserProperties().getProperty('quizotic_active_code')
  if (!code) return { error: 'No active session. Start one first.' }
  const res = quizoticFetch_('/api/v1/sessions/' + code + '/control', {
    method: 'post',
    payload: JSON.stringify({ action: action }),
    contentType: 'application/json',
  })
  if (res.status !== 200) {
    return { error: 'Control failed (' + res.status + '): ' + res.getContentText() }
  }
  // Refresh the snapshot alongside so the sidebar updates without a second
  // round-trip.
  return { ok: true, snapshot: getSnapshot().snapshot }
}

/**
 * Read-only snapshot of the active session for the sidebar's live readout.
 */
function getSnapshot() {
  const code = PropertiesService.getUserProperties().getProperty('quizotic_active_code')
  if (!code) return { snapshot: null }
  const res = quizoticFetch_('/api/v1/sessions/' + code + '/snapshot', { method: 'get' })
  if (res.status === 404) return { snapshot: null }
  if (res.status !== 200) return { snapshot: null }
  return { snapshot: JSON.parse(res.getContentText()).data }
}

function clearActiveSession() {
  PropertiesService.getUserProperties().deleteProperty('quizotic_active_code')
  return { ok: true }
}

// ─── Internals ───────────────────────────────────────────────────────────

function getApiKey() {
  return PropertiesService.getUserProperties().getProperty('quizotic_api_key')
}
function setApiKey(key) {
  PropertiesService.getUserProperties().setProperty('quizotic_api_key', key)
}

function maskKey(key) {
  if (!key || key.length < 10) return 'qz_••••'
  return key.slice(0, 6) + new Array(key.length - 10 + 1).join('•') + key.slice(-4)
}

/**
 * UrlFetchApp wrapper that injects the Bearer API key and the JSON content
 * type. Throws on network errors; returns the HTTPResponse for the caller to
 * inspect status.
 */
function quizoticFetch_(path, options, explicitKey) {
  const key = explicitKey || getApiKey()
  if (!key) throw new Error('No API key set.')
  const opts = options || {}
  opts.headers = Object.assign({ Authorization: 'Bearer ' + key }, opts.headers || {})
  opts.muteHttpExceptions = true
  // Apps Script's UrlFetchApp imposes strict quotas and the urlFetchWhitelist
  // in appsscript.json gates the host. Both are satisfied by BASE_URL.
  return UrlFetchApp.fetch(BASE_URL + path, opts)
}

/**
 * Insert a placeholder shape onto the current slide containing the game code
 * and a link to the join URL. The audience joins from their phones while the
 * host runs the live sidebar.
 */
function insertPlaceholderSlide_(gameCode, joinUrl) {
  const presentation = SlidesApp.getActivePresentation()
  if (!presentation) return
  const slide = presentation.getSelection().getCurrentSlide()
    || presentation.getSlides()[0]
  if (!slide) return
  const textBox = slide.insertTextBox(
    'Quizotic Live\nJoin at quizotic.live/join\nGame code: ' + gameCode,
    300,
    180
  )
  textBox.getLeft() // touch to ensure it's placed
  // Center-ish on the slide.
  const pw = presentation.getPageWidth()
  const ph = presentation.getPageHeight()
  textBox.setLeft((pw - 300) / 2)
  textBox.setTop((ph - 180) / 2)
  const textStyle = textBox.getTextRange().getTextStyle()
  textStyle.setFontSize(28)
  textStyle.setForegroundColor(SlidesApp.newColor().setRgbColor('#1a1a2e').build())
  const fill = textBox.getFill()
  fill.setSolidFill('#FBD13B')
}
