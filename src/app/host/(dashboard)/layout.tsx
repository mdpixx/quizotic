'use client'

import { useState } from 'react'
import { HostSidebar } from '@/components/host/HostSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex" style={{ minHeight: '100vh', background: '#F8F7FF' }}>
      <HostSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Mobile top bar — hamburger + logo */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-30" style={{ background: 'rgba(248,247,255,0.96)', backdropFilter: 'blur(8px)', borderColor: 'rgba(67,97,238,0.1)' }}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-blue-50"
            style={{ border: '1.5px solid rgba(67,97,238,0.15)' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" style={{ color: '#4361EE' }}>
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Quizo<span style={{ color: '#4361EE' }}>tic</span>
            <span className="text-[9px] font-bold tracking-wide ml-0.5 animate-pulse" style={{ color: '#22C55E', verticalAlign: 'super' }}>.live</span>
          </span>
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
