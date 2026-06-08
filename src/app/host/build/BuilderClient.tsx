'use client'

/**
 * BuilderClient — thin 'use client' shell that reads searchParams and
 * renders <QuizBuilder>. Separated from the page so the server component
 * can handle the flag redirect without bundling client code.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { QuizBuilder } from '@/components/host/builder/QuizBuilder'

function BuilderInner({ editId }: { editId: string | null }) {
  const searchParams = useSearchParams()
  const resolvedEditId = editId ?? searchParams.get('edit')
  return <QuizBuilder editId={resolvedEditId} />
}

export function BuilderClient({ editId }: { editId: string | null }) {
  return (
    <Suspense fallback={null}>
      <BuilderInner editId={editId} />
    </Suspense>
  )
}
