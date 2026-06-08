import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { BuilderClient } from './BuilderClient'

/**
 * /host/build — the new Slido-style quiz builder (v2).
 *
 * Gated by NEXT_PUBLIC_BUILDER_V2=true env var OR ?v2=1 query param so the
 * old /host/create builder keeps working untouched during the transition.
 *
 * Flip sequence:
 *   1. Test on /host/build?v2=1 (no env var needed)
 *   2. Set NEXT_PUBLIC_BUILDER_V2=true on Railway → all traffic uses new builder
 *   3. Point studio "Create quiz" link at /host/build
 *   4. Delete /host/create once verified
 */

interface PageProps {
  searchParams: Promise<{ v2?: string; edit?: string; type?: string; returnTo?: string }>
}

export default async function BuildPage({ searchParams }: PageProps) {
  const params = await searchParams
  const flagEnabled = process.env.NEXT_PUBLIC_BUILDER_V2 === 'true' || params.v2 === '1'

  // Guard: if flag isn't on and no ?v2=1, redirect to legacy builder
  if (!flagEnabled) {
    const qs = new URLSearchParams()
    if (params.edit) qs.set('edit', params.edit)
    if (params.type) qs.set('type', params.type)
    if (params.returnTo) qs.set('returnTo', params.returnTo)
    qs.set('start', 'manual')
    redirect(`/host/create?${qs.toString()}`)
  }

  const editId = params.edit ?? null

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen" style={{ background: '#F8F9FA' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading builder…</p>
        </div>
      </div>
    }>
      <BuilderClient editId={editId} />
    </Suspense>
  )
}
