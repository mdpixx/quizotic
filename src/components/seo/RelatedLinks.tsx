import Link from 'next/link'

export interface RelatedLink {
  title: string
  href: string
  description: string
}

interface RelatedLinksProps {
  heading?: string
  links: RelatedLink[]
}

export function RelatedLinks({ heading = 'Related', links }: RelatedLinksProps) {
  if (links.length === 0) return null
  return (
    <section className="mt-16 border-t border-slate-200 pt-10">
      <h2 className="text-2xl font-semibold text-slate-900 mb-6">{heading}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-xl border border-slate-200 p-5 transition hover:border-slate-400 hover:shadow-sm"
            >
              <h3 className="font-medium text-slate-900">{link.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{link.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
