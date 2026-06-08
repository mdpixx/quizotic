import { Suspense } from 'react'
import { BuilderClient } from './BuilderClient'

interface PageProps {
  searchParams: Promise<{ edit?: string; type?: string; returnTo?: string }>
}

export default async function BuildPage({ searchParams }: PageProps) {
  const params = await searchParams
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
