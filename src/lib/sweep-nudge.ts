// Wake the async-session sweep loop in server.mjs after creating or
// rescheduling async work (publish, attempt start, close-now). The sweeper
// sleeps until the next known deadline to let Neon's compute scale to zero,
// so anything that introduces an EARLIER deadline must nudge it awake.
//
// server.mjs registers the hook on globalThis because Next.js route handlers
// run in the same process but are bundled separately — a module export there
// isn't importable from here. Optional chaining keeps this a safe no-op in
// tests and any context where the custom server isn't running.
export function nudgeAsyncSweep(): void {
  ;(globalThis as { __quizoticNudgeAsyncSweep?: () => void }).__quizoticNudgeAsyncSweep?.()
}
