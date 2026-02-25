# FTP Model Registry (dev/release)

## 목적

- MLflow 서빙은 옵션으로 유지
- 실제 배포는 FTP 기반으로 모델 번들을 제공
- `dev` / `release` 스테이지를 분리해 버전을 관리
- 클라이언트는 `LATEST` 또는 특정 버전(`v0003`)으로 다운로드

## 디렉토리 표준

FTP 루트(`FTP_REGISTRY_ROOT`) 아래:

```text
/<stage>/<model_slug>/
  LATEST
  LATEST.json
  index.json
  /versions/<version>/
    bundle.tar.gz
    manifest.json
    /payload/...
```

- `LATEST`: 최신 버전 문자열 (예: `v0005`)
- `index.json`: 버전 히스토리 및 메타데이터
- `bundle.tar.gz`: 클라이언트 다운로드 표준 아티팩트

## 운영 플로우

1. 학습 완료 후 MLflow run 선택
2. `/api/ftp-registry/publish`로 `dev` stage에 publish
3. 검증 통과 시 `/api/ftp-registry/promote`로 `release` stage 승격
4. 클라이언트는 FTP 접속 후 `LATEST` 확인 후 번들 다운로드

## API

### 1) MLflow에서 dev publish

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-registry/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "modelName":"classification-best-model",
    "stage":"dev",
    "sourceType":"mlflow",
    "trackingUri":"http://127.0.0.1:5001",
    "runId":"<RUN_ID>",
    "artifactPath":"model",
    "setLatest":true
  }'
```

### 2) Local `.pth/.pt` publish + PyTorch 표준 변환

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-registry/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "modelName":"classification-best-model",
    "stage":"dev",
    "sourceType":"local",
    "localPath":"./outputs/checkpoints/best_checkpoint.pth",
    "convertToTorchStandard":true,
    "torchTaskType":"classification",
    "torchNumClasses":5,
    "setLatest":true
  }'
```

변환이 켜지면 payload에 `model-standard.pt`가 생성되고,
manifest/index에 `standardArtifacts.pytorch` 경로가 기록됩니다.

### 3) dev -> release promote

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-registry/promote \
  -H 'Content-Type: application/json' \
  -d '{
    "modelName":"classification-best-model",
    "fromStage":"dev",
    "toStage":"release",
    "version":"latest",
    "setLatest":true
  }'
```

### 4) 모델 resolve (latest/특정 버전)

```bash
curl 'http://127.0.0.1:8008/api/ftp-registry/models/release/classification-best-model/resolve?version=latest'
```

## FTP 서버 실행

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-server/start \
  -H 'Content-Type: application/json' \
  -d '{
    "host":"0.0.0.0",
    "port":2121,
    "username":"mlops",
    "password":"mlops123!"
  }'
```

중지:

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-server/stop \
  -H 'Content-Type: application/json' \
  -d '{"serverId":"<SERVER_ID>"}'
```

## 클라이언트 다운로드 예시

```bash
.venv/bin/python backend/scripts/ftp_model_client.py \
  --host 127.0.0.1 \
  --port 2121 \
  --username mlops \
  --password 'mlops123!' \
  --stage release \
  --model-name classification-best-model \
  --version latest
```

Python 코드에서 바로 쓰는 권장 방식(싱글톤 + dataclass config):

```python
from scripts.ftp_model_client import FtpModelClientConfig, get_ftp_model_registry_client

config = FtpModelClientConfig(
    host="127.0.0.1",
    port=2121,
    username="mlops",
    password="mlops123!",
)

client = get_ftp_model_registry_client(config)
bundle = client.get("release", "classification-best-model", "latest")

# torch.hub cache 하위 경로에 저장/압축해제됨
print(bundle.preferred_weight_path)
# torch.load(bundle.preferred_weight_path, map_location="cpu")
```

`preferred_weight_path`는 우선순위로 `model-standard.pt`를 먼저 선택합니다.

## 참고

- FTP는 전송 암호화가 없으므로, 실제 운영망에서는 FTPS/SFTP 또는 내부망/터널/VPN과 함께 사용을 권장합니다.
- 이 레지스트리는 모델 버전 배포(artifact distribution) 용도이며, 실시간 inference는 기존 API/MLflow serve를 그대로 사용 가능합니다.
