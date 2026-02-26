import { useCallback, useState } from 'react'

import type { NoticeItem } from '../components/app-shell/NoticeStack'

interface UseNoticeCenterOptions {
  limit?: number
}

export function useNoticeCenter({ limit = 6 }: UseNoticeCenterOptions = {}) {
  const [notices, setNotices] = useState<NoticeItem[]>([])

  const pushNotice = useCallback((level: NoticeItem['level'], message: string, detail?: string) => {
    setNotices((previous) => [{ level, message, detail, timestamp: Date.now() }, ...previous].slice(0, limit))
  }, [limit])

  return {
    notices,
    pushNotice,
  }
}
