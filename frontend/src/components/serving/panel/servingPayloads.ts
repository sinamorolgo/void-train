import type {
  DownloadFromFtpPayload,
  DownloadFromMlflowPayload,
  LoadLocalModelPayload,
  PublishBestFtpModelPayload,
  PublishFtpModelPayload,
  StartRayServingPayload,
  UploadLocalFtpModelPayload,
} from './types'
import type {
  FtpDownloadFormState,
  LocalLoaderFormState,
  MlflowDownloadFormState,
  RayServeFormState,
  PublishBestFormState,
  RegisterLocalFormState,
  UploadRegisterFormState,
} from './types'

export function buildMlflowDownloadPayload(
  form: MlflowDownloadFormState,
  destinationDir: string,
): DownloadFromMlflowPayload {
  return {
    trackingUri: form.trackingUri,
    runId: form.runId,
    artifactPath: form.artifactPath,
    destinationDir,
  }
}

export function buildFtpDownloadPayload(form: FtpDownloadFormState, destinationDir: string): DownloadFromFtpPayload {
  return {
    host: form.host,
    port: form.port,
    username: form.username,
    password: form.password,
    remotePath: form.remotePath,
    destinationDir,
  }
}

export function buildRayServePayload(form: RayServeFormState): StartRayServingPayload {
  return {
    modelUri: form.modelUri,
    host: form.host,
    port: form.port,
    appName: form.appName || undefined,
    routePrefix: form.routePrefix || undefined,
  }
}

export function buildPublishBestPayload(form: PublishBestFormState): PublishBestFtpModelPayload {
  return {
    taskType: form.taskType,
    stage: form.stage,
    trackingUri: form.trackingUri || undefined,
    experimentName: form.experimentName || undefined,
    metric: form.metric || undefined,
    mode: form.mode,
    modelName: form.modelName || undefined,
    artifactPath: form.artifactPath || undefined,
    version: form.version || undefined,
    setLatest: true,
    notes: form.notes || undefined,
    convertToTorchStandard: form.convertToTorchStandard,
    torchTaskType: form.torchTaskType,
    torchNumClasses: form.torchNumClasses,
  }
}

export function buildRegisterLocalPayload(form: RegisterLocalFormState): PublishFtpModelPayload {
  return {
    modelName: form.modelName,
    stage: form.stage,
    sourceType: 'local',
    localPath: form.localPath,
    version: form.version || undefined,
    setLatest: true,
    notes: form.notes || undefined,
    convertToTorchStandard: form.convertToTorchStandard,
    torchTaskType: form.taskType,
    torchNumClasses: form.numClasses,
  }
}

export function buildUploadLocalPayload(form: UploadRegisterFormState): UploadLocalFtpModelPayload | null {
  if (!form.file) return null
  return {
    file: form.file,
    modelName: form.modelName,
    stage: form.stage,
    version: form.version || undefined,
    setLatest: true,
    notes: form.notes || undefined,
    convertToTorchStandard: form.convertToTorchStandard,
    torchTaskType: form.taskType,
    torchNumClasses: form.numClasses,
  }
}

export function buildLoadLocalPayload(form: LocalLoaderFormState): LoadLocalModelPayload {
  return {
    alias: form.alias,
    modelPath: form.modelPath,
    taskType: form.taskType,
    numClasses: form.numClasses,
  }
}

export function safeParseJsonInput(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown JSON parse error' }
  }
}
