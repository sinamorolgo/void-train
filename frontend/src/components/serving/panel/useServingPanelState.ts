import { useState } from 'react'

import type {
  FtpDownloadFormState,
  LocalLoaderFormState,
  LocalPredictFormState,
  MlflowDownloadFormState,
  RayServeFormState,
  PublishBestFormState,
  RegisterLocalFormState,
  UploadRegisterFormState,
} from './types'

function bestDefaultsForTask(taskType: PublishBestFormState['taskType']) {
  if (taskType === 'classification') {
    return { metric: 'val_accuracy', modelName: 'classification-best-model' }
  }
  return { metric: 'val_iou', modelName: 'segmentation-best-model' }
}

export function useServingPanelState() {
  const [destinationDir, setDestinationDir] = useState('./backend/artifacts/downloads')

  const [mlflowDownloadForm, setMlflowDownloadForm] = useState<MlflowDownloadFormState>({
    trackingUri: 'http://127.0.0.1:5001',
    runId: '',
    artifactPath: 'model',
  })

  const [ftpDownloadForm, setFtpDownloadForm] = useState<FtpDownloadFormState>({
    host: '',
    port: 21,
    username: '',
    password: '',
    remotePath: '',
  })

  const [rayServeForm, setRayServeForm] = useState<RayServeFormState>({
    modelUri: 'models:/classification-best-model/1',
    host: '0.0.0.0',
    port: 7001,
    appName: 'void-train-manager',
    routePrefix: '/',
  })

  const [localLoaderForm, setLocalLoaderForm] = useState<LocalLoaderFormState>({
    alias: 'local-classifier',
    modelPath: '',
    taskType: 'classification',
    numClasses: 5,
  })

  const [registerLocalForm, setRegisterLocalForm] = useState<RegisterLocalFormState>({
    modelName: 'classification-best-model',
    stage: 'dev',
    localPath: '',
    version: '',
    notes: '',
    taskType: 'classification',
    numClasses: 2,
    convertToTorchStandard: true,
  })

  const [publishBestForm, setPublishBestForm] = useState<PublishBestFormState>({
    trackingUri: 'http://127.0.0.1:5001',
    experimentName: 'void-train-manager',
    taskType: 'classification',
    metric: 'val_accuracy',
    mode: 'max',
    modelName: 'classification-best-model',
    artifactPath: 'model',
    stage: 'dev',
    version: '',
    notes: '',
    convertToTorchStandard: true,
    torchTaskType: 'classification',
    torchNumClasses: 2,
  })

  const [uploadRegisterForm, setUploadRegisterForm] = useState<UploadRegisterFormState>({
    modelName: 'classification-best-model',
    stage: 'dev',
    version: '',
    notes: '',
    taskType: 'classification',
    numClasses: 2,
    convertToTorchStandard: true,
    file: null,
  })

  const [localPredictForm, setLocalPredictForm] = useState<LocalPredictFormState>({
    alias: 'local-classifier',
    inputJson: '[[[[0.1,0.2],[0.3,0.4]]]]',
  })

  const patchMlflowDownloadForm = (patch: Partial<MlflowDownloadFormState>) => {
    setMlflowDownloadForm((prev) => ({ ...prev, ...patch }))
  }
  const patchFtpDownloadForm = (patch: Partial<FtpDownloadFormState>) => {
    setFtpDownloadForm((prev) => ({ ...prev, ...patch }))
  }
  const patchRayServeForm = (patch: Partial<RayServeFormState>) => {
    setRayServeForm((prev) => ({ ...prev, ...patch }))
  }
  const patchLocalLoaderForm = (patch: Partial<LocalLoaderFormState>) => {
    setLocalLoaderForm((prev) => ({ ...prev, ...patch }))
  }
  const patchRegisterLocalForm = (patch: Partial<RegisterLocalFormState>) => {
    setRegisterLocalForm((prev) => ({ ...prev, ...patch }))
  }
  const patchPublishBestForm = (patch: Partial<PublishBestFormState>) => {
    setPublishBestForm((prev) => ({ ...prev, ...patch }))
  }
  const patchUploadRegisterForm = (patch: Partial<UploadRegisterFormState>) => {
    setUploadRegisterForm((prev) => ({ ...prev, ...patch }))
  }
  const patchLocalPredictForm = (patch: Partial<LocalPredictFormState>) => {
    setLocalPredictForm((prev) => ({ ...prev, ...patch }))
  }

  const setPublishBestTaskType = (taskType: PublishBestFormState['taskType']) => {
    const defaults = bestDefaultsForTask(taskType)
    setPublishBestForm((prev) => ({
      ...prev,
      taskType,
      torchTaskType: taskType,
      metric: defaults.metric,
      modelName: defaults.modelName,
    }))
  }

  const clearUploadFile = () => {
    setUploadRegisterForm((prev) => ({ ...prev, file: null }))
  }

  return {
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
  }
}
