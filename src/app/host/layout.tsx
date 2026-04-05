import { HostNav } from '@/components/HostNav'

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HostNav />
      {children}
    </>
  )
}
