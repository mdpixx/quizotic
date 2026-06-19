'use client'

import { useState } from 'react'
import { HostSidebar } from '@/components/host/HostSidebar'
import { QuizoticLogo } from '@/components/QuizoticLogo'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FA' }}>
      <HostSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Mobile top bar — hamburger + logo */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-30" style={{ background: 'rgba(15,27,61,0.97)', backdropFilter: 'blur(8px)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ border: '1.5px solid rgba(255,255,255,0.15)', color: '#FBD13B' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <QuizoticLogo variant="onDark" className="text-base" markSize={28} />
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
