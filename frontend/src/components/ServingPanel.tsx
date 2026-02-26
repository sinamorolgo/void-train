import { useState } from 'react'

import { SectionCard } from './SectionCard'
import { ServingDownloadsGrid } from './serving/panel/ServingDownloadsGrid'
import { ServingOperationsGrid } from './serving/panel/ServingOperationsGrid'
import {
  buildFtpDownloadPayload,
  buildLoadLocalPayload,
  buildMlflowDownloadPayload,
  buildRayServePayload,
  buildPublishBestPayload,
  buildRegisterLocalPayload,
  buildUploadLocalPayload,
  safeParseJsonInput,
} from './serving/panel/servingPayloads'
import type { LocalPredictFormState, ServingPanelProps } from './serving/panel/types'
import { useServingPanelState } from './serving/panel/useServingPanelState'

export function ServingPanel({
  localModels,
  rayServers,
  mlflowExperiments,
  registryModels,
  busy,
  onDownloadFromMlflow,
  onDownloadFromFtp,
  onStartRayServing,
  onStopRayServing,
  onLoadLocalModel,
  onPublishFtpModel,
  onPublishBestFtpModel,
  onUploadLocalFtpModel,
  onDownloadRegistryModel,
  onPredict,
}: ServingPanelProps) {
  const [predictInputError, setPredictInputError] = useState<string | null>(null)
  const {
    destinationDir,
    setDestinationDir,
    mlflowDownloadForm,
    ftpDownloadForm,
    rayServeForm,
    localLoaderForm,
    registerLocalForm,
    publishBestForm,
    uploadRegisterForm,
    localPredictForm,
    patchMlflowDownloadForm,
    patchFtpDownloadForm,
    patchRayServeForm,
    patchLocalLoaderForm,
    patchRegisterLocalForm,
    patchPublishBestForm,
    patchUploadRegisterForm,
    patchLocalPredictForm,
    setPublishBestTaskType,
    clearUploadFile,
  } = useServingPanelState()

  const handleMlflowDownload = () => {
    onDownloadFromMlflow(buildMlflowDownloadPayload(mlflowDownloadForm, destinationDir))
  }

  const handleFtpDownload = () => {
    onDownloadFromFtp(buildFtpDownloadPayload(ftpDownloadForm, destinationDir))
  }

  const handleRayServeStart = () => {
    onStartRayServing(buildRayServePayload(rayServeForm))
  }

  const handleBestPublish = () => {
    onPublishBestFtpModel(buildPublishBestPayload(publishBestForm))
  }

  const handleRegisterPytorch = () => {
    onPublishFtpModel(buildRegisterLocalPayload(registerLocalForm))
  }

  const handleUploadPytorch = () => {
    const payload = buildUploadLocalPayload(uploadRegisterForm)
    if (!payload) return
    onUploadLocalFtpModel(payload)
    clearUploadFile()
  }

  const handleLoadLocalModel = () => {
    onLoadLocalModel(buildLoadLocalPayload(localLoaderForm))
  }

  const handleLocalPredict = () => {
    const parsed = safeParseJsonInput(localPredictForm.inputJson)
    if (!parsed.ok) {
      setPredictInputError(parsed.error)
      return
    }
    setPredictInputError(null)
    onPredict(localPredictForm.alias, parsed.value)
  }

  const handlePatchLocalPredictForm = (patch: Partial<LocalPredictFormState>) => {
    if (patch.inputJson !== undefined) {
      setPredictInputError(null)
    }
    patchLocalPredictForm(patch)
  }

  return (
    <SectionCard title="Model Serving" subtitle="Ray Serve 기반 API 서빙과 FTP fallback + 로컬 로더 운영을 함께 지원합니다.">
      <ServingDownloadsGrid
        busy={busy}
        rayServers={rayServers}
        destinationDir={destinationDir}
        mlflowDownloadForm={mlflowDownloadForm}
        ftpDownloadForm={ftpDownloadForm}
        rayServeForm={rayServeForm}
        onDestinationDirChange={setDestinationDir}
        onPatchMlflowDownloadForm={patchMlflowDownloadForm}
        onPatchFtpDownloadForm={patchFtpDownloadForm}
        onPatchRayServeForm={patchRayServeForm}
        onDownloadFromMlflow={handleMlflowDownload}
        onDownloadFromFtp={handleFtpDownload}
        onStartRayServing={handleRayServeStart}
        onStopRayServing={onStopRayServing}
      />

      <ServingOperationsGrid
        busy={busy}
        localModels={localModels}
        mlflowExperiments={mlflowExperiments}
        registryModels={registryModels}
        registerLocalForm={registerLocalForm}
        publishBestForm={publishBestForm}
        uploadRegisterForm={uploadRegisterForm}
        localLoaderForm={localLoaderForm}
        localPredictForm={localPredictForm}
        predictInputError={predictInputError}
        onPatchRegisterLocalForm={patchRegisterLocalForm}
        onPatchPublishBestForm={patchPublishBestForm}
        onPatchUploadRegisterForm={patchUploadRegisterForm}
        onPatchLocalLoaderForm={patchLocalLoaderForm}
        onPatchLocalPredictForm={handlePatchLocalPredictForm}
        onSetPublishBestTaskType={setPublishBestTaskType}
        onRegisterPytorch={handleRegisterPytorch}
        onPublishBest={handleBestPublish}
        onUploadPytorch={handleUploadPytorch}
        onLoadLocalModel={handleLoadLocalModel}
        onPredictLocalModel={handleLocalPredict}
        onDownloadRegistryModel={onDownloadRegistryModel}
      />
    </SectionCard>
  )
}
