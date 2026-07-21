export const dynamic = 'force-dynamic'

import { TaskpaneApp } from '@/components/embed/TaskpaneApp'

export const metadata = {
  title: 'Quizotic for PowerPoint',
  description: 'Host live quizzes inside your slide deck',
}

/**
 * Office add-in taskpane. Served at /embed/taskpane and referenced from
 * public/manifest.xml. The taskpane is a small host-control surface that
 * runs inside PowerPoint's iframe: the presenter connects their Quizotic
 * account (API key), picks a quiz, starts a live session, inserts a
 * placeholder onto the current slide, and drives the session with the
 * control buttons. The on-slide live view (/embed/session/:code) is
 * swapped in by Office.js during slideshow.
 *
 * Marked force-dynamic so the page isn't statically cached — Office loads
 * the taskpane fresh on each open.
 */
export default function TaskpanePage() {
  return <TaskpaneApp />
}
