export const dynamic = 'force-dynamic'

import { publicSnapshotLiveSession } from '@/lib/live-control'
import { EmbedLiveView } from '@/components/embed/EmbedLiveView'

export const metadata = {
  title: 'Quizotic Live',
  description: 'Live quiz on stage',
}

// Server component: resolve the initial snapshot so the embed paints with real
// data on first load (no client-side polling flash). The client component
// takes over and polls /api/embed/snapshot every 1.5s for updates.
export default async function EmbedSessionPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const initial = publicSnapshotLiveSession(code)
  return <EmbedLiveView gameCode={code} initialSnapshot={initial} />
}
