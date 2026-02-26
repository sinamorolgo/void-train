import { SectionCard } from './SectionCard'
import { ServingDownloadsGrid } from './serving/panel/ServingDownloadsGrid'
import { ServingOperationsGrid } from './serving/panel/ServingOperationsGrid'
import type { ServingPanelProps } from './serving/panel/types'
import { useServingPanelState } from './serving/panel/useServingPanelState'

export function ServingPanel({
  localModels,
  mlflowServers,
  mlflowExperiments,
  registryModels,
  busy,
  onDownloadFromMlflow,
  onDownloadFromFtp,
  onStartMlflowServing,
  onStopMlflowServing,
  onLoadLocalModel,
  onPublishFtpModel,
  onPublishBestFtpModel,
  onUploadLocalFtpModel,
  onDownloadRegistryModel,
  onPredict,
}: ServingPanelProps) {
  const {
    destinationDir,
    setDestinationDir,
    mlflowDownloadForm,
    ftpDownloadForm,
    mlflowServeForm,
    localLoaderForm,
    registerLocalForm,
    publishBestForm,
    uploadRegisterForm,
    localPredictForm,
    patchMlflowDownloadForm,
    patchFtpDownloadForm,
    patchMlflowServeForm,
    patchLocalLoaderForm,
    patchRegisterLocalForm,
    patchPublishBestForm,
    patchUploadRegisterForm,
    patchLocalPredictForm,
    setPublishBestTaskType,
    clearUploadFile,
  } = useServingPanelState()

  const handleMlflowDownload = () => {
    onDownloadFromMlflow({
      trackingUri: mlflowDownloadForm.trackingUri,
      runId: mlflowDownloadForm.runId,
      artifactPath: mlflowDownloadForm.artifactPath,
      destinationDir,
    })
  }

  const handleFtpDownload = () => {
    onDownloadFromFtp({
      host: ftpDownloadForm.host,
      port: ftpDownloadForm.port,
      username: ftpDownloadForm.username,
      password: ftpDownloadForm.password,
      remotePath: ftpDownloadForm.remotePath,
      destinationDir,
    })
  }

  const handleMlflowServeStart = () => {
    onStartMlflowServing({
      modelUri: mlflowServeForm.modelUri,
      host: mlflowServeForm.host,
      port: mlflowServeForm.port,
    })
  }

  const handleBestPublish = () => {
    onPublishBestFtpModel({
      taskType: publishBestForm.taskType,
      stage: publishBestForm.stage,
      trackingUri: publishBestForm.trackingUri || undefined,
      experimentName: publishBestForm.experimentName || undefined,
      metric: publishBestForm.metric || undefined,
      mode: publishBestForm.mode,
      modelName: publishBestForm.modelName || undefined,
      artifactPath: publishBestForm.artifactPath || undefined,
      version: publishBestForm.version || undefined,
      setLatest: true,
      notes: publishBestForm.notes || undefined,
      convertToTorchStandard: publishBestForm.convertToTorchStandard,
      torchTaskType: publishBestForm.torchTaskType,
      torchNumClasses: publishBestForm.torchNumClasses,
    })
  }

  const handleRegisterPytorch = () => {
    onPublishFtpModel({
      modelName: registerLocalForm.modelName,
      stage: registerLocalForm.stage,
      sourceType: 'local',
      localPath: registerLocalForm.localPath,
      version: registerLocalForm.version || undefined,
      setLatest: true,
      notes: registerLocalForm.notes || undefined,
      convertToTorchStandard: registerLocalForm.convertToTorchStandard,
      torchTaskType: registerLocalForm.taskType,
      torchNumClasses: registerLocalForm.numClasses,
    })
  }

  const handleUploadPytorch = () => {
    if (!uploadRegisterForm.file) return
    onUploadLocalFtpModel({
      file: uploadRegisterForm.file,
      modelName: uploadRegisterForm.modelName,
      stage: uploadRegisterForm.stage,
      version: uploadRegisterForm.version || undefined,
      setLatest: true,
      notes: uploadRegisterForm.notes || undefined,
      convertToTorchStandard: uploadRegisterForm.convertToTorchStandard,
      torchTaskType: uploadRegisterForm.taskType,
      torchNumClasses: uploadRegisterForm.numClasses,
    })
    clearUploadFile()
  }

  const handleLoadLocalModel = () => {
    onLoadLocalModel({
      alias: localLoaderForm.alias,
      modelPath: localLoaderForm.modelPath,
      taskType: localLoaderForm.taskType,
      numClasses: localLoaderForm.numClasses,
    })
  }

  const handleLocalPredict = () => {
    const parsed = JSON.parse(localPredictForm.inputJson)
    onPredict(localPredictForm.alias, parsed)
  }

  return (
    <SectionCard title="Model Serving" subtitle="MLflow serve 우선, 필요 시 FTP fallback + 로컬 로더로 운영할 수 있습니다.">
      <ServingDownloadsGrid
        busy={busy}
        mlflowServers={mlflowServers}
        destinationDir={destinationDir}
        mlflowDownloadForm={mlflowDownloadForm}
        ftpDownloadForm={ftpDownloadForm}
        mlflowServeForm={mlflowServeForm}
        onDestinationDirChange={setDestinationDir}
        onPatchMlflowDownloadForm={patchMlflowDownloadForm}
        onPatchFtpDownloadForm={patchFtpDownloadForm}
        onPatchMlflowServeForm={patchMlflowServeForm}
        onDownloadFromMlflow={handleMlflowDownload}
        onDownloadFromFtp={handleFtpDownload}
        onStartMlflowServing={handleMlflowServeStart}
        onStopMlflowServing={onStopMlflowServing}
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
        onPatchRegisterLocalForm={patchRegisterLocalForm}
        onPatchPublishBestForm={patchPublishBestForm}
        onPatchUploadRegisterForm={patchUploadRegisterForm}
        onPatchLocalLoaderForm={patchLocalLoaderForm}
        onPatchLocalPredictForm={patchLocalPredictForm}
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
