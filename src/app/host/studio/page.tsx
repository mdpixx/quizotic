import { redirect } from 'next/navigation'

// Studio has been retired — the Quiz/Presentation choice now lives on the
// dashboard itself. This redirect preserves any bookmarks or inbound links.
export default function StudioPage() {
  redirect('/host')
}
