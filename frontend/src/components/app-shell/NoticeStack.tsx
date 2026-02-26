export interface NoticeItem {
  level: 'info' | 'success' | 'error'
  message: string
  detail?: string
  timestamp: number
}

interface NoticeStackProps {
  notices: NoticeItem[]
}

export function NoticeStack({ notices }: NoticeStackProps) {
  return (
    <aside className="notice-stack" aria-live="polite" aria-relevant="additions text">
      {notices.map((notice) => (
        <article key={notice.timestamp} className={`notice ${notice.level}`} role={notice.level === 'error' ? 'alert' : 'status'}>
          <strong>{notice.message}</strong>
          {notice.detail ? <pre>{notice.detail}</pre> : null}
        </article>
      ))}
    </aside>
  )
}
