import { useCallback, useEffect, useState } from 'react'

export type AppView = 'operations' | 'catalog' | 'studio'

const TAB_QUERY_KEY = 'tab'

function parseViewFromUrl(): AppView {
  const tab = new URLSearchParams(window.location.search).get(TAB_QUERY_KEY)
  if (tab === 'studio') return 'studio'
  return tab === 'catalog' ? 'catalog' : 'operations'
}

function syncViewToUrl(nextView: AppView): void {
  const url = new URL(window.location.href)
  if (nextView === 'operations') {
    url.searchParams.delete(TAB_QUERY_KEY)
  } else {
    url.searchParams.set(TAB_QUERY_KEY, nextView)
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

interface UseWorkspaceTabsProps {
  catalogDirty: boolean
  studioDirty: boolean
}

export function useWorkspaceTabs({ catalogDirty, studioDirty }: UseWorkspaceTabsProps) {
  const [activeView, setActiveView] = useState<AppView>(() => parseViewFromUrl())

  useEffect(() => {
    syncViewToUrl(activeView)
  }, [activeView])

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(parseViewFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!(catalogDirty || studioDirty)) return undefined
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [catalogDirty, studioDirty])

  const handleViewChange = useCallback(
    (nextView: AppView) => {
      if (nextView === activeView) return
      const hasUnsaved = (activeView === 'catalog' && catalogDirty) || (activeView === 'studio' && studioDirty)
      if (hasUnsaved) {
        const shouldLeave = window.confirm('저장되지 않은 YAML 변경사항이 있습니다. 탭을 이동하시겠어요?')
        if (!shouldLeave) return
      }
      setActiveView(nextView)
    },
    [activeView, catalogDirty, studioDirty],
  )

  return {
    activeView,
    handleViewChange,
  }
}
