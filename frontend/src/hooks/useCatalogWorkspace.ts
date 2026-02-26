import { useMemo, useState } from 'react'
import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'

import type { NoticeItem } from '../components/app-shell/NoticeStack'
import type { CatalogManagerPanelProps } from '../components/CatalogManagerPanel'
import type { CatalogStudioPanelProps } from '../components/CatalogStudioPanel'
import { api, errorMessage } from '../lib/api'
import type {
  CatalogStudioRegistryModel,
  CatalogStudioTask,
  CatalogValidationResult,
} from '../types'

export type CatalogValidationState = 'idle' | 'valid' | 'invalid'

interface CatalogStudioDraft {
  tasks: CatalogStudioTask[]
  registryModels: CatalogStudioRegistryModel[]
}

interface UseCatalogWorkspaceOptions {
  queryClient: QueryClient
  pushNotice: (level: NoticeItem['level'], message: string, detail?: string) => void
}

export interface CatalogWorkspaceState {
  catalogDirty: boolean
  studioDirty: boolean
  isWorking: boolean
  catalogPanelProps: CatalogManagerPanelProps
  studioPanelProps: CatalogStudioPanelProps
}

export function useCatalogWorkspace({ queryClient, pushNotice }: UseCatalogWorkspaceOptions): CatalogWorkspaceState {
  const [catalogDraftOverride, setCatalogDraftOverride] = useState<string | null>(null)
  const [catalogBaselineOverride, setCatalogBaselineOverride] = useState<string | null>(null)
  const [createBackup, setCreateBackup] = useState(true)
  const [catalogValidation, setCatalogValidation] = useState<CatalogValidationResult | null>(null)
  const [catalogValidationError, setCatalogValidationError] = useState<string | null>(null)
  const [catalogValidationState, setCatalogValidationState] = useState<CatalogValidationState>('idle')
  const [catalogValidatedAt, setCatalogValidatedAt] = useState<string | null>(null)

  const [studioDraftOverride, setStudioDraftOverride] = useState<CatalogStudioDraft | null>(null)
  const [studioBaselineOverride, setStudioBaselineOverride] = useState<CatalogStudioDraft | null>(null)
  const [studioCreateBackup, setStudioCreateBackup] = useState(true)
  const [studioSaveError, setStudioSaveError] = useState<string | null>(null)

  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: api.getCatalog,
    refetchOnWindowFocus: false,
  })

  const catalogStudioQuery = useQuery({
    queryKey: ['catalog-studio'],
    queryFn: api.getCatalogStudio,
    refetchOnWindowFocus: false,
  })

  const catalogDraft = catalogDraftOverride ?? catalogQuery.data?.content ?? ''
  const catalogBaseline = catalogBaselineOverride ?? catalogQuery.data?.content ?? ''
  const catalogTasks = catalogValidation?.tasks ?? catalogQuery.data?.tasks ?? []
  const catalogTaskCount = catalogValidation?.taskCount ?? catalogQuery.data?.taskCount ?? null
  const catalogDirty = catalogDraft !== catalogBaseline

  const studioDraft = useMemo<CatalogStudioDraft>(
    () =>
      studioDraftOverride ?? {
        tasks: catalogStudioQuery.data?.tasks ?? [],
        registryModels: catalogStudioQuery.data?.registryModels ?? [],
      },
    [studioDraftOverride, catalogStudioQuery.data?.tasks, catalogStudioQuery.data?.registryModels],
  )

  const studioBaseline = useMemo<CatalogStudioDraft>(
    () =>
      studioBaselineOverride ?? {
        tasks: catalogStudioQuery.data?.tasks ?? [],
        registryModels: catalogStudioQuery.data?.registryModels ?? [],
      },
    [studioBaselineOverride, catalogStudioQuery.data?.tasks, catalogStudioQuery.data?.registryModels],
  )

  const studioDirty = JSON.stringify(studioDraft) !== JSON.stringify(studioBaseline)

  const validateCatalogMutation = useMutation({
    mutationFn: () => api.validateCatalog(catalogDraft),
    onSuccess: (result) => {
      setCatalogValidation(result)
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice('success', `Catalog validation passed (${result.taskCount} tasks)`)
    },
    onError: (error) => {
      const message = errorMessage(error)
      setCatalogValidationError(message)
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog validation failed', message)
    },
  })

  const formatCatalogMutation = useMutation({
    mutationFn: () => api.formatCatalog(catalogDraft),
    onSuccess: (result) => {
      setCatalogDraftOverride(result.content)
      setCatalogValidation({
        valid: true,
        taskCount: result.taskCount,
        tasks: result.tasks,
      })
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice('success', 'Catalog formatted', `Normalized YAML (${result.taskCount} tasks)`)
    },
    onError: (error) => {
      const message = errorMessage(error)
      setCatalogValidationError(message)
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog format failed', message)
    },
  })

  const saveCatalogMutation = useMutation({
    mutationFn: () => api.saveCatalog({ content: catalogDraft, createBackup }),
    onSuccess: (saved) => {
      setCatalogDraftOverride(saved.content)
      setCatalogBaselineOverride(saved.content)
      setCatalogValidation({
        valid: true,
        taskCount: saved.taskCount,
        tasks: saved.tasks,
      })
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice(
        'success',
        'Catalog saved and applied',
        saved.backupPath ? `Backup created: ${saved.backupPath}` : 'Saved without backup',
      )
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
    },
    onError: (error) => {
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog save failed', errorMessage(error))
    },
  })

  const saveCatalogStudioMutation = useMutation({
    mutationFn: () =>
      api.saveCatalogStudio({
        tasks: studioDraft.tasks,
        registryModels: studioDraft.registryModels,
        createBackup: studioCreateBackup,
      }),
    onSuccess: (saved) => {
      const syncedDraft = {
        tasks: saved.tasks,
        registryModels: saved.registryModels,
      }
      setStudioDraftOverride(syncedDraft)
      setStudioBaselineOverride(syncedDraft)
      setStudioSaveError(null)
      pushNotice(
        'success',
        'Studio catalog saved',
        saved.backupPath ? `Backup created: ${saved.backupPath}` : 'Saved without backup',
      )
      queryClient.invalidateQueries({ queryKey: ['catalog-studio'] })
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
      queryClient.invalidateQueries({ queryKey: ['ftp-registry-catalog-models'] })
    },
    onError: (error) => {
      const message = errorMessage(error)
      setStudioSaveError(message)
      pushNotice('error', 'Studio save failed', message)
    },
  })

  const catalogPanelProps: CatalogManagerPanelProps = {
    catalogPath: catalogQuery.data?.path ?? 'Loading…',
    catalogExists: catalogQuery.data?.exists ?? true,
    modifiedAt: catalogQuery.data?.modifiedAt ?? null,
    validationState: catalogValidationState,
    validatedAt: catalogValidatedAt,
    value: catalogDraft,
    dirty: catalogDirty,
    createBackup,
    isLoading: catalogQuery.isLoading,
    isValidating: validateCatalogMutation.isPending,
    isFormatting: formatCatalogMutation.isPending,
    isSaving: saveCatalogMutation.isPending,
    validationTaskCount: catalogTaskCount,
    validationTasks: catalogTasks,
    validationError: catalogValidationError,
    onValueChange: (nextValue) => {
      setCatalogDraftOverride(nextValue)
      setCatalogValidationError(null)
      setCatalogValidationState('idle')
    },
    onCreateBackupChange: setCreateBackup,
    onValidate: () => validateCatalogMutation.mutate(),
    onFormat: () => formatCatalogMutation.mutate(),
    onSave: () => saveCatalogMutation.mutate(),
    onResetDraft: () => {
      setCatalogDraftOverride(catalogBaseline)
      setCatalogValidationError(null)
      setCatalogValidationState('idle')
    },
    onReload: () => {
      setCatalogValidationError(null)
      setCatalogDraftOverride(null)
      setCatalogBaselineOverride(null)
      setCatalogValidation(null)
      setCatalogValidationState('idle')
      setCatalogValidatedAt(null)
      void catalogQuery.refetch()
    },
  }

  const studioPanelProps: CatalogStudioPanelProps = {
    catalogPath: catalogStudioQuery.data?.path ?? 'Loading…',
    modifiedAt: catalogStudioQuery.data?.modifiedAt ?? null,
    tasks: studioDraft.tasks,
    registryModels: studioDraft.registryModels,
    dirty: studioDirty,
    createBackup: studioCreateBackup,
    isLoading: catalogStudioQuery.isLoading,
    isSaving: saveCatalogStudioMutation.isPending,
    saveError: studioSaveError,
    onCreateBackupChange: setStudioCreateBackup,
    onTasksChange: (nextTasks) => {
      setStudioSaveError(null)
      setStudioDraftOverride({
        ...studioDraft,
        tasks: nextTasks,
      })
    },
    onRegistryModelsChange: (nextRegistryModels) => {
      setStudioSaveError(null)
      setStudioDraftOverride({
        ...studioDraft,
        registryModels: nextRegistryModels,
      })
    },
    onSave: () => saveCatalogStudioMutation.mutate(),
    onResetDraft: () => {
      setStudioSaveError(null)
      setStudioDraftOverride(studioBaseline)
    },
    onReload: () => {
      setStudioSaveError(null)
      setStudioDraftOverride(null)
      setStudioBaselineOverride(null)
      void catalogStudioQuery.refetch()
    },
  }

  const isWorking =
    validateCatalogMutation.isPending ||
    formatCatalogMutation.isPending ||
    saveCatalogMutation.isPending ||
    saveCatalogStudioMutation.isPending

  return {
    catalogDirty,
    studioDirty,
    isWorking,
    catalogPanelProps,
    studioPanelProps,
  }
}
