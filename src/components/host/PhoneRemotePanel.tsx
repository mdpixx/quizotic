'use client'

// PhoneRemotePanel — the host-only "run this from your phone" section that sits
// at the foot of the lobby's white PIN card, under a hairline divider.
//
// Why it lives INSIDE the PIN card rather than in the action bar: the lobby is a
// two-column grid, and the PIN card used to be shorter than the players panel
// beside it, leaving dead white space at the bottom of the left column. Putting
// this here fills that space, keeps every host control in the left column, and
// makes the two columns read as the same height.
//
// LOBBY ONLY — deliberately. Account-based pairing already blocks participants
// (server.mjs host_join_remote rejects any socket whose userId doesn't match the
// session owner's), but a host-only QR on a projector mid-quiz would still have
// a room full of people scanning their way to a sign-in wall. The affordance is
// therefore offered while the host is still at the laptop and nobody is looking
// at the screen for answers.

interface PhoneRemotePanelProps {
  onOpen: () => void
}

export function PhoneRemotePanel({ onOpen }: PhoneRemotePanelProps) {
  // shrink-0, and deliberately ONE row tall. The card is a flex column whose
  // participant QR flexes; this section must keep its natural height so the QR
  // never pays for it. Every pixel here is a pixel off a QR that people read
  // from the back of a room — hence the single line, with the "host only" tag
  // inside the button rather than on a caption line of its own.
  return (
    <div className="shrink-0 mt-3 pt-3" style={{ borderTop: '1.5px solid #E8EAF2' }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Use your phone as a remote"
        title="Host only — run the quiz from your phone instead of this laptop. Participants join with the game PIN."
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-all hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[#7e1f9b] focus-visible:ring-offset-2"
        style={{
          background: '#F6F3FD',
          color: '#46107a',
          border: '1.5px solid #D9CBF2',
          fontFamily: 'var(--font-heading)',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0" aria-hidden>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
        <span>Phone remote</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]"
          style={{ background: '#EADCF9', color: '#7e1f9b' }}
        >
          Host only
        </span>
      </button>
    </div>
  )
}
