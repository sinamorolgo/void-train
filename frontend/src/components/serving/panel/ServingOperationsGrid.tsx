import type { LocalModel, MlflowExperimentItem, RegistryArtifact, RegistryCatalogModel } from '../../../types'
import { LocalLoaderCard } from '../LocalLoaderCard'
import { LocalPredictCard } from '../LocalPredictCard'
import { RegisterBestMlflowCard } from '../RegisterBestMlflowCard'
import { RegisterPytorchCard } from '../RegisterPytorchCard'
import { RegistryModelBrowserCard } from '../RegistryModelBrowserCard'
import { UploadPytorchCard } from '../UploadPytorchCard'
import type {
  LocalLoaderFormState,
  LocalPredictFormState,
  PublishBestFormState,
  RegisterLocalFormState,
  UploadRegisterFormState,
} from './types'

interface ServingOperationsGridProps {
  busy: boolean
  localModels: LocalModel[]
  mlflowExperiments: MlflowExperimentItem[]
  registryModels: RegistryCatalogModel[]
  registerLocalForm: RegisterLocalFormState
  publishBestForm: PublishBestFormState
  uploadRegisterForm: UploadRegisterFormState
  localLoaderForm: LocalLoaderFormState
  localPredictForm: LocalPredictFormState
  onPatchRegisterLocalForm: (patch: Partial<RegisterLocalFormState>) => void
  onPatchPublishBestForm: (patch: Partial<PublishBestFormState>) => void
  onPatchUploadRegisterForm: (patch: Partial<UploadRegisterFormState>) => void
  onPatchLocalLoaderForm: (patch: Partial<LocalLoaderFormState>) => void
  onPatchLocalPredictForm: (patch: Partial<LocalPredictFormState>) => void
  onSetPublishBestTaskType: (taskType: PublishBestFormState['taskType']) => void
  onRegisterPytorch: () => void
  onPublishBest: () => void
  onUploadPytorch: () => void
  onLoadLocalModel: () => void
  onPredictLocalModel: () => void
  onDownloadRegistryModel: (payload: {
    modelName: string
    stage: 'dev' | 'release'
    version: string
    artifact: RegistryArtifact
    destinationDir: string
  }) => void
}

export function ServingOperationsGrid({
  busy,
  localModels,
  mlflowExperiments,
  registryModels,
  registerLocalForm,
  publishBestForm,
  uploadRegisterForm,
  localLoaderForm,
  localPredictForm,
  onPatchRegisterLocalForm,
  onPatchPublishBestForm,
  onPatchUploadRegisterForm,
  onPatchLocalLoaderForm,
  onPatchLocalPredictForm,
  onSetPublishBestTaskType,
  onRegisterPytorch,
  onPublishBest,
  onUploadPytorch,
  onLoadLocalModel,
  onPredictLocalModel,
  onDownloadRegistryModel,
}: ServingOperationsGridProps) {
  return (
    <div className="mlflow-grid">
      <RegistryModelBrowserCard models={registryModels} busy={busy} onDownload={onDownloadRegistryModel} />

      <RegisterBestMlflowCard
        trackingUri={publishBestForm.trackingUri}
        experimentName={publishBestForm.experimentName}
        taskType={publishBestForm.taskType}
        metric={publishBestForm.metric}
        mode={publishBestForm.mode}
        modelName={publishBestForm.modelName}
        artifactPath={publishBestForm.artifactPath}
        stage={publishBestForm.stage}
        version={publishBestForm.version}
        notes={publishBestForm.notes}
        convertToTorchStandard={publishBestForm.convertToTorchStandard}
        torchTaskType={publishBestForm.torchTaskType}
        torchNumClasses={publishBestForm.torchNumClasses}
        experiments={mlflowExperiments}
        busy={busy}
        onTrackingUriChange={(value) => onPatchPublishBestForm({ trackingUri: value })}
        onExperimentNameChange={(value) => onPatchPublishBestForm({ experimentName: value })}
        onTaskTypeChange={onSetPublishBestTaskType}
        onMetricChange={(value) => onPatchPublishBestForm({ metric: value })}
        onModeChange={(value) => onPatchPublishBestForm({ mode: value })}
        onModelNameChange={(value) => onPatchPublishBestForm({ modelName: value })}
        onArtifactPathChange={(value) => onPatchPublishBestForm({ artifactPath: value })}
        onStageChange={(value) => onPatchPublishBestForm({ stage: value })}
        onVersionChange={(value) => onPatchPublishBestForm({ version: value })}
        onNotesChange={(value) => onPatchPublishBestForm({ notes: value })}
        onConvertChange={(value) => onPatchPublishBestForm({ convertToTorchStandard: value })}
        onTorchTaskTypeChange={(value) => onPatchPublishBestForm({ torchTaskType: value })}
        onTorchNumClassesChange={(value) => onPatchPublishBestForm({ torchNumClasses: value })}
        onPublish={onPublishBest}
      />

      <RegisterPytorchCard
        modelName={registerLocalForm.modelName}
        stage={registerLocalForm.stage}
        localPath={registerLocalForm.localPath}
        version={registerLocalForm.version}
        notes={registerLocalForm.notes}
        taskType={registerLocalForm.taskType}
        numClasses={registerLocalForm.numClasses}
        convertToTorchStandard={registerLocalForm.convertToTorchStandard}
        busy={busy}
        onModelNameChange={(value) => onPatchRegisterLocalForm({ modelName: value })}
        onStageChange={(value) => onPatchRegisterLocalForm({ stage: value })}
        onLocalPathChange={(value) => onPatchRegisterLocalForm({ localPath: value })}
        onVersionChange={(value) => onPatchRegisterLocalForm({ version: value })}
        onNotesChange={(value) => onPatchRegisterLocalForm({ notes: value })}
        onTaskTypeChange={(value) => onPatchRegisterLocalForm({ taskType: value })}
        onNumClassesChange={(value) => onPatchRegisterLocalForm({ numClasses: value })}
        onConvertChange={(value) => onPatchRegisterLocalForm({ convertToTorchStandard: value })}
        onRegister={onRegisterPytorch}
      />

      <UploadPytorchCard
        modelName={uploadRegisterForm.modelName}
        stage={uploadRegisterForm.stage}
        version={uploadRegisterForm.version}
        notes={uploadRegisterForm.notes}
        taskType={uploadRegisterForm.taskType}
        numClasses={uploadRegisterForm.numClasses}
        convertToTorchStandard={uploadRegisterForm.convertToTorchStandard}
        fileName={uploadRegisterForm.file?.name ?? ''}
        busy={busy}
        onModelNameChange={(value) => onPatchUploadRegisterForm({ modelName: value })}
        onStageChange={(value) => onPatchUploadRegisterForm({ stage: value })}
        onVersionChange={(value) => onPatchUploadRegisterForm({ version: value })}
        onNotesChange={(value) => onPatchUploadRegisterForm({ notes: value })}
        onTaskTypeChange={(value) => onPatchUploadRegisterForm({ taskType: value })}
        onNumClassesChange={(value) => onPatchUploadRegisterForm({ numClasses: value })}
        onConvertChange={(value) => onPatchUploadRegisterForm({ convertToTorchStandard: value })}
        onFileChange={(file) => onPatchUploadRegisterForm({ file })}
        onUpload={onUploadPytorch}
      />

      <LocalLoaderCard
        alias={localLoaderForm.alias}
        modelPath={localLoaderForm.modelPath}
        taskType={localLoaderForm.taskType}
        numClasses={localLoaderForm.numClasses}
        models={localModels}
        busy={busy}
        onAliasChange={(value) => onPatchLocalLoaderForm({ alias: value })}
        onModelPathChange={(value) => onPatchLocalLoaderForm({ modelPath: value })}
        onTaskTypeChange={(value) => onPatchLocalLoaderForm({ taskType: value })}
        onNumClassesChange={(value) => onPatchLocalLoaderForm({ numClasses: value })}
        onLoad={onLoadLocalModel}
      />

      <LocalPredictCard
        alias={localPredictForm.alias}
        inputJson={localPredictForm.inputJson}
        busy={busy}
        onAliasChange={(value) => onPatchLocalPredictForm({ alias: value })}
        onInputJsonChange={(value) => onPatchLocalPredictForm({ inputJson: value })}
        onPredict={onPredictLocalModel}
      />
    </div>
  )
}
