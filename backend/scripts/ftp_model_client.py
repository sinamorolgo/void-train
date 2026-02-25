from __future__ import annotations

import argparse
import io
import json
import tarfile
from dataclasses import dataclass
from ftplib import FTP
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Literal

import torch

Stage = Literal["dev", "release"]


def _slugify_model_name(model_name: str) -> str:
    return model_name.strip().lower().replace(" ", "-")


@dataclass(frozen=True)
class FtpModelClientConfig:
    host: str
    port: int = 21
    username: str = "mlops"
    password: str = "mlops123!"
    timeout_sec: int = 30
    cache_root: str | None = None

    @classmethod
    def from_env(cls) -> "FtpModelClientConfig":
        import os

        return cls(
            host=os.getenv("FTP_DEFAULT_HOST", "127.0.0.1"),
            port=int(os.getenv("FTP_DEFAULT_PORT", "2121")),
            username=os.getenv("FTP_DEFAULT_USERNAME", "mlops"),
            password=os.getenv("FTP_DEFAULT_PASSWORD", "mlops123!"),
            cache_root=os.getenv("FTP_MODEL_CACHE_ROOT") or None,
        )

    @property
    def resolved_cache_root(self) -> Path:
        if self.cache_root:
            return Path(self.cache_root).expanduser().resolve()
        return (Path(torch.hub.get_dir()) / "void-train-manager" / "ftp-model-registry").resolve()


@dataclass(frozen=True)
class DownloadedModelBundle:
    stage: Stage
    model_name: str
    model_slug: str
    resolved_version: str
    version_dir: Path
    bundle_path: Path
    manifest_path: Path
    extracted_payload_dir: Path
    preferred_weight_path: Path | None
    source: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage,
            "modelName": self.model_name,
            "modelSlug": self.model_slug,
            "resolvedVersion": self.resolved_version,
            "versionDir": str(self.version_dir),
            "bundlePath": str(self.bundle_path),
            "manifestPath": str(self.manifest_path),
            "extractedPayloadDir": str(self.extracted_payload_dir),
            "preferredWeightPath": str(self.preferred_weight_path) if self.preferred_weight_path else None,
            "source": self.source,
        }


class FtpModelRegistryClient:
    def __init__(self, config: FtpModelClientConfig) -> None:
        self._config = config
        self._cache_root = config.resolved_cache_root
        self._cache_root.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> FTP:
        ftp = FTP()
        ftp.connect(host=self._config.host, port=self._config.port, timeout=self._config.timeout_sec)
        ftp.login(user=self._config.username, passwd=self._config.password)
        return ftp

    def _read_text(self, ftp: FTP, remote_path: str) -> str:
        buffer = io.BytesIO()
        ftp.retrbinary(f"RETR {remote_path}", buffer.write, blocksize=256 * 1024)
        return buffer.getvalue().decode("utf-8").strip()

    def _download_file(self, ftp: FTP, remote_path: str, local_path: Path) -> None:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        remote_size = ftp.size(remote_path)

        # Avoid redundant transfer if already cached.
        if remote_size is not None and local_path.exists() and local_path.stat().st_size == remote_size:
            return

        with NamedTemporaryFile(prefix=f".{local_path.name}.", suffix=".part", dir=local_path.parent, delete=False) as tmp:
            temp_path = Path(tmp.name)
            with temp_path.open("wb") as stream:
                ftp.retrbinary(f"RETR {remote_path}", stream.write, blocksize=1024 * 1024)
        temp_path.replace(local_path)

    def _resolve_version(self, ftp: FTP, stage: Stage, model_slug: str, version: str) -> str:
        if version != "latest":
            return version
        latest_path = f"/{stage}/{model_slug}/LATEST"
        resolved = self._read_text(ftp, latest_path)
        if not resolved:
            raise RuntimeError(f"LATEST pointer is empty: {latest_path}")
        return resolved

    def _extract_payload(self, bundle_path: Path, payload_root: Path) -> Path:
        payload_root.mkdir(parents=True, exist_ok=True)
        marker = payload_root / ".extracted"
        if marker.exists() and marker.stat().st_mtime >= bundle_path.stat().st_mtime:
            extracted_payload = payload_root / "payload"
            return extracted_payload if extracted_payload.exists() else payload_root

        with tarfile.open(bundle_path, "r:gz") as tar:
            tar.extractall(path=payload_root)
        marker.touch()

        extracted_payload = payload_root / "payload"
        return extracted_payload if extracted_payload.exists() else payload_root

    def _preferred_weight_path(self, payload_dir: Path) -> Path | None:
        preferred_names = [
            "model-standard.pt",
            "best_checkpoint.pth",
            "best_checkpoint.pt",
            "model.pth",
            "model.pt",
        ]
        for preferred_name in preferred_names:
            found = sorted(payload_dir.rglob(preferred_name))
            if found:
                return found[0]

        candidates = sorted(payload_dir.rglob("*.pt")) + sorted(payload_dir.rglob("*.pth"))
        return candidates[0] if candidates else None

    def get(self, stage: Stage, model_name: str, version: str = "latest") -> DownloadedModelBundle:
        model_slug = _slugify_model_name(model_name)
        with self._connect() as ftp:
            resolved_version = self._resolve_version(ftp, stage, model_slug, version)
            remote_root = f"/{stage}/{model_slug}/versions/{resolved_version}"
            manifest_remote = f"{remote_root}/manifest.json"
            bundle_remote = f"{remote_root}/bundle.tar.gz"

            version_dir = self._cache_root / stage / model_slug / resolved_version
            manifest_path = version_dir / "manifest.json"
            bundle_path = version_dir / "bundle.tar.gz"

            self._download_file(ftp, manifest_remote, manifest_path)
            self._download_file(ftp, bundle_remote, bundle_path)

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        payload_dir = self._extract_payload(bundle_path, version_dir / "extracted")
        preferred_weight = self._preferred_weight_path(payload_dir)

        return DownloadedModelBundle(
            stage=stage,
            model_name=model_name,
            model_slug=model_slug,
            resolved_version=resolved_version,
            version_dir=version_dir,
            bundle_path=bundle_path,
            manifest_path=manifest_path,
            extracted_payload_dir=payload_dir,
            preferred_weight_path=preferred_weight,
            source=manifest.get("source", {}),
        )


_CLIENT_SINGLETONS: dict[FtpModelClientConfig, FtpModelRegistryClient] = {}


def get_ftp_model_registry_client(config: FtpModelClientConfig | None = None) -> FtpModelRegistryClient:
    resolved_config = config or FtpModelClientConfig.from_env()
    client = _CLIENT_SINGLETONS.get(resolved_config)
    if client is None:
        client = FtpModelRegistryClient(resolved_config)
        _CLIENT_SINGLETONS[resolved_config] = client
    return client


def main() -> None:
    parser = argparse.ArgumentParser(description="Download model bundle from FTP model registry")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=21)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--stage", choices=["dev", "release"], default="release")
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--version", default="latest")
    parser.add_argument("--cache-root", default=None)
    args = parser.parse_args()

    config = FtpModelClientConfig(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        cache_root=args.cache_root,
    )
    client = get_ftp_model_registry_client(config)
    result = client.get(stage=args.stage, model_name=args.model_name, version=args.version)
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
