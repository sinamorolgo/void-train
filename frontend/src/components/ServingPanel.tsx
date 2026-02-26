import { useState } from 'react'

import type { LocalModel, MlflowServeServer, RegistryArtifact, RegistryCatalogModel, TaskType } from '../types'
import { SectionCard } from './SectionCard'
import { DownloadFtpCard } from './serving/DownloadFtpCard'
import { DownloadMlflowCard } from './serving/DownloadMlflowCard'
import { LocalLoaderCard } from './serving/LocalLoaderCard'
import { LocalPredictCard } from './serving/LocalPredictCard'
import { MlflowServeCard } from './serving/MlflowServeCard'
import { RegistryModelBrowserCard } from './serving/RegistryModelBrowserCard'
import { RegisterPytorchCard } from './serving/RegisterPytorchCard'

interface ServingPanelProps {
  localModels: LocalModel[]
  mlflowServers: MlflowServeServer[]
  registryModels: RegistryCatalogModel[]
  busy: boolean
  onDownloadFromMlflow: (payload: {
    trackingUri: string
    runId: string
    artifactPath: string
    destinationDir: string
  }) => void
  onDownloadFromFtp: (payload: {
    host: string
    port: number
    username: string
    password: string
    remotePath: string
    destinationDir: string
  }) => void
  onStartMlflowServing: (payload: { modelUri: string; host: string; port: number }) => void
  onStopMlflowServing: (serverId: string) => void
  onLoadLocalModel: (payload: {
    alias: string
    modelPath: string
    taskType?: TaskType
    numClasses?: number
  }) => void
  onPublishFtpModel: (payload: {
    modelName: string
    stage: 'dev' | 'release'
    sourceType: 'local'
    localPath: string
    version?: string
    setLatest?: boolean
    notes?: string
    convertToTorchStandard?: boolean
    torchTaskType?: 'classification' | 'segmentation'
    torchNumClasses?: number
  }) => void
  onDownloadRegistryModel: (payload: {
    modelName: string
    stage: 'dev' | 'release'
    version: string
    artifact: RegistryArtifact
    destinationDir: string
  }) => void
  onPredict: (alias: string, inputs: unknown) => void
}

export function ServingPanel({
  localModels,
  mlflowServers,
  registryModels,
  busy,
  onDownloadFromMlflow,
  onDownloadFromFtp,
  onStartMlflowServing,
  onStopMlflowServing,
  onLoadLocalModel,
  onPublishFtpModel,
  onDownloadRegistryModel,
  onPredict,
}: ServingPanelProps) {
  const [trackingUri, setTrackingUri] = useState('http://127.0.0.1:5001')
  const [runId, setRunId] = useState('')
  const [artifactPath, setArtifactPath] = useState('model')
  const [destinationDir, setDestinationDir] = useState('./backend/artifacts/downloads')

  const [ftpHost, setFtpHost] = useState('')
  const [ftpPort, setFtpPort] = useState(21)
  const [ftpUser, setFtpUser] = useState('')
  const [ftpPassword, setFtpPassword] = useState('')
  const [ftpRemotePath, setFtpRemotePath] = useState('')

  const [modelUri, setModelUri] = useState('models:/classification-best-model/1')
  const [serveHost, setServeHost] = useState('0.0.0.0')
  const [servePort, setServePort] = useState(7001)

  const [alias, setAlias] = useState('local-classifier')
  const [modelPath, setModelPath] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('classification')
  const [numClasses, setNumClasses] = useState(5)

  const [registerModelName, setRegisterModelName] = useState('classification-best-model')
  const [registerStage, setRegisterStage] = useState<'dev' | 'release'>('dev')
  const [registerLocalPath, setRegisterLocalPath] = useState('')
  const [registerVersion, setRegisterVersion] = useState('')
  const [registerNotes, setRegisterNotes] = useState('')
  const [registerTaskType, setRegisterTaskType] = useState<'classification' | 'segmentation'>('classification')
  const [registerNumClasses, setRegisterNumClasses] = useState(2)
  const [convertToTorchStandard, setConvertToTorchStandard] = useState(true)

  const [predictAlias, setPredictAlias] = useState('local-classifier')
  const [predictInput, setPredictInput] = useState('[[[[0.1,0.2],[0.3,0.4]]]]')

  return (
    <SectionCard title="Model Serving" subtitle="MLflow serve 우선, 필요 시 FTP fallback + 로컬 로더로 운영할 수 있습니다.">
      <div className="mlflow-grid">
        <DownloadMlflowCard
          trackingUri={trackingUri}
          runId={runId}
          artifactPath={artifactPath}
          destinationDir={destinationDir}
          busy={busy}
          onTrackingUriChange={setTrackingUri}
          onRunIdChange={setRunId}
          onArtifactPathChange={setArtifactPath}
          onDestinationDirChange={setDestinationDir}
          onDownload={() => onDownloadFromMlflow({ trackingUri, runId, artifactPath, destinationDir })}
        />

        <DownloadFtpCard
          host={ftpHost}
          port={ftpPort}
          username={ftpUser}
          password={ftpPassword}
          remotePath={ftpRemotePath}
          destinationDir={destinationDir}
          busy={busy}
          onHostChange={setFtpHost}
          onPortChange={setFtpPort}
          onUsernameChange={setFtpUser}
          onPasswordChange={setFtpPassword}
          onRemotePathChange={setFtpRemotePath}
          onDestinationDirChange={setDestinationDir}
          onDownload={() =>
            onDownloadFromFtp({
              host: ftpHost,
              port: ftpPort,
              username: ftpUser,
              password: ftpPassword,
              remotePath: ftpRemotePath,
              destinationDir,
            })
          }
        />

        <MlflowServeCard
          modelUri={modelUri}
          host={serveHost}
          port={servePort}
          busy={busy}
          servers={mlflowServers}
          onModelUriChange={setModelUri}
          onHostChange={setServeHost}
          onPortChange={setServePort}
          onStart={() => onStartMlflowServing({ modelUri, host: serveHost, port: servePort })}
          onStop={onStopMlflowServing}
        />
      </div>

      <div className="mlflow-grid">
        <RegistryModelBrowserCard
          models={registryModels}
          busy={busy}
          onDownload={onDownloadRegistryModel}
        />

        <RegisterPytorchCard
          modelName={registerModelName}
          stage={registerStage}
          localPath={registerLocalPath}
          version={registerVersion}
          notes={registerNotes}
          taskType={registerTaskType}
          numClasses={registerNumClasses}
          convertToTorchStandard={convertToTorchStandard}
          busy={busy}
          onModelNameChange={setRegisterModelName}
          onStageChange={setRegisterStage}
          onLocalPathChange={setRegisterLocalPath}
          onVersionChange={setRegisterVersion}
          onNotesChange={setRegisterNotes}
          onTaskTypeChange={setRegisterTaskType}
          onNumClassesChange={setRegisterNumClasses}
          onConvertChange={setConvertToTorchStandard}
          onRegister={() =>
            onPublishFtpModel({
              modelName: registerModelName,
              stage: registerStage,
              sourceType: 'local',
              localPath: registerLocalPath,
              version: registerVersion || undefined,
              setLatest: true,
              notes: registerNotes || undefined,
              convertToTorchStandard,
              torchTaskType: registerTaskType,
              torchNumClasses: registerNumClasses,
            })
          }
        />

        <LocalLoaderCard
          alias={alias}
          modelPath={modelPath}
          taskType={taskType}
          numClasses={numClasses}
          models={localModels}
          busy={busy}
          onAliasChange={setAlias}
          onModelPathChange={setModelPath}
          onTaskTypeChange={setTaskType}
          onNumClassesChange={setNumClasses}
          onLoad={() => onLoadLocalModel({ alias, modelPath, taskType, numClasses })}
        />

        <LocalPredictCard
          alias={predictAlias}
          inputJson={predictInput}
          busy={busy}
          onAliasChange={setPredictAlias}
          onInputJsonChange={setPredictInput}
          onPredict={() => {
            const parsed = JSON.parse(predictInput)
            onPredict(predictAlias, parsed)
          }}
        />
      </div>
    </SectionCard>
  )
}
