import type { PropsWithChildren, ReactNode } from 'react'

interface SectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}
