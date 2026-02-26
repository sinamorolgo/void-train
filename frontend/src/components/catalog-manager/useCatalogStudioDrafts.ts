import { useState } from 'react'

import type { BaseTaskType } from '../../types'
import type { BuilderDraft } from './catalogManagerUtils'
import { defaultBuilderDraft, defaultStudioDrafts, switchBuilderBaseTask } from './catalogManagerUtils'

export function useCatalogStudioDrafts() {
  const [studioTasks, setStudioTasks] = useState<BuilderDraft[]>(() => defaultStudioDrafts())
  const [studioStatus, setStudioStatus] = useState<string | null>(null)

  const updateStudioTask = (index: number, patch: Partial<BuilderDraft>) => {
    setStudioTasks((prev) =>
      prev.map((draft, currentIndex) => (currentIndex === index ? { ...draft, ...patch } : draft)),
    )
  }

  const updateStudioBaseTask = (index: number, nextBaseTaskType: BaseTaskType) => {
    setStudioTasks((prev) =>
      prev.map((draft, currentIndex) =>
        currentIndex === index ? switchBuilderBaseTask(draft, nextBaseTaskType) : draft,
      ),
    )
  }

  const addStudioTask = (baseTaskType: BaseTaskType) => {
    setStudioTasks((prev) => [...prev, defaultBuilderDraft(baseTaskType)])
  }

  const duplicateStudioTask = (index: number) => {
    setStudioTasks((prev) => {
      const picked = prev[index]
      if (!picked) return prev
      const next = [...prev]
      next.splice(index + 1, 0, { ...picked })
      return next
    })
    setStudioStatus(`Duplicated Task #${index + 1}.`)
  }

  const moveStudioTask = (index: number, direction: -1 | 1) => {
    setStudioTasks((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [picked] = next.splice(index, 1)
      next.splice(nextIndex, 0, picked)
      return next
    })
    setStudioStatus(`Moved Task #${index + 1} ${direction < 0 ? 'up' : 'down'}.`)
  }

  const sortStudioTasksByTaskType = () => {
    setStudioTasks((prev) =>
      [...prev].sort((a, b) => {
        const left = a.taskType.trim().toLowerCase()
        const right = b.taskType.trim().toLowerCase()
        return left.localeCompare(right)
      }),
    )
    setStudioStatus('Sorted studio tasks by taskType.')
  }

  const removeStudioTask = (index: number) => {
    setStudioTasks((prev) => (prev.length <= 1 ? prev : prev.filter((_, currentIndex) => currentIndex !== index)))
  }

  const resetStudioTasks = () => {
    setStudioTasks(defaultStudioDrafts())
    setStudioStatus('Studio tasks reset to dual defaults.')
  }

  return {
    studioTasks,
    studioStatus,
    setStudioTasks,
    setStudioStatus,
    updateStudioTask,
    updateStudioBaseTask,
    addStudioTask,
    duplicateStudioTask,
    moveStudioTask,
    sortStudioTasksByTaskType,
    removeStudioTask,
    resetStudioTasks,
  }
}
