from __future__ import annotations

import json
import re
import shutil
import tarfile
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import torch

from app.core.settings import get_settings
from app.services.mlflow_service import download_artifact

StageType = Literal["dev", "release"]


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _slugify(text: str, *, fallback: str, allow_dot: bool = False) -> str:
    candidate = text.strip().lower().replace(" ", "-")
    pattern = r"[^a-z0-9_.-]" if allow_dot else r"[^a-z0-9_-]"
    cleaned = re.sub(pattern, "", candidate)
    cleaned = cleaned.strip(".-_")
    return cleaned or fallback


def _walk_file_entries(root: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file():
            continue
        entries.append(
            {
                "path": file_path.relative_to(root).as_posix(),
                "bytes": file_path.stat().st_size,
            }
        )
    return entries


class FtpModelRegistry:
    def __init__(self, root_dir: Path) -> None:
        self._root_dir = root_dir.expanduser().resolve()
        self._lock = threading.Lock()
        self._root_dir.mkdir(parents=True, exist_ok=True)
        for stage in ("dev", "release"):
            (self._root_dir / stage).mkdir(parents=True, exist_ok=True)

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    def _stage_dir(self, stage: StageType) -> Path:
        return self._root_dir / stage

    def _model_slug(self, model_name: str) -> str:
        return _slugify(model_name, fallback="model")

    def _version_slug(self, version_name: str) -> str:
        return _slugify(version_name, fallback="v0001", allow_dot=True)

    def _model_dir(self, stage: StageType, model_name: str) -> Path:
        return self._stage_dir(stage) / self._model_slug(model_name)

    def _index_path(self, stage: StageType, model_name: str) -> Path:
        return self._model_dir(stage, model_name) / "index.json"

    def _default_index(self, stage: StageType, model_name: str) -> dict[str, Any]:
        return {
            "modelName": model_name,
            "stage": stage,
            "latest": None,
            "versions": [],
            "updatedAt": _utc_now(),
        }

    def _read_index(self, stage: StageType, model_name: str) -> dict[str, Any]:
        path = self._index_path(stage, model_name)
        if not path.exists():
            return self._default_index(stage, model_name)

        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)

    def _write_index(self, stage: StageType, model_name: str, index: dict[str, Any]) -> None:
        model_dir = self._model_dir(stage, model_name)
        model_dir.mkdir(parents=True, exist_ok=True)
        index["updatedAt"] = _utc_now()

        index_path = model_dir / "index.json"
        with index_path.open("w", encoding="utf-8") as stream:
            json.dump(index, stream, ensure_ascii=False, indent=2)

        latest = index.get("latest")
        latest_txt_path = model_dir / "LATEST"
        latest_json_path = model_dir / "LATEST.json"

        if latest:
            latest_txt_path.write_text(str(latest), encoding="utf-8")

            entry = next((item for item in index.get("versions", []) if item.get("version") == latest), None)
            payload = {
                "modelName": model_name,
                "stage": stage,
                "latest": latest,
                "entry": entry,
                "updatedAt": index["updatedAt"],
            }
            latest_json_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        else:
            latest_txt_path.unlink(missing_ok=True)
            latest_json_path.unlink(missing_ok=True)

    def _next_version(self, index: dict[str, Any]) -> str:
        max_num = 0
        for item in index.get("versions", []):
            version_name = str(item.get("version", ""))
            matched = re.match(r"^v(\d+)$", version_name)
            if matched:
                max_num = max(max_num, int(matched.group(1)))
        return f"v{max_num + 1:04d}"

    def _resolve_version(self, index: dict[str, Any], requested_version: str | None) -> str:
        if requested_version:
            return self._version_slug(requested_version)
        return self._next_version(index)

    def _build_ftp_paths(
        self,
        *,
        stage: StageType,
        model_slug: str,
        version: str,
        bundle_name: str,
    ) -> dict[str, str]:
        version_root = f"/{stage}/{model_slug}/versions/{version}"
        return {
            "bundle": f"{version_root}/{bundle_name}",
            "manifest": f"{version_root}/manifest.json",
            "latest": f"/{stage}/{model_slug}/LATEST",
            "index": f"/{stage}/{model_slug}/index.json",
            "root": f"/{stage}/{model_slug}",
        }

    def _copy_payload(self, source_path: Path, payload_dir: Path) -> list[dict[str, Any]]:
        payload_dir.mkdir(parents=True, exist_ok=True)

        if source_path.is_dir():
            for child in source_path.iterdir():
                target = payload_dir / child.name
                if child.is_dir():
                    shutil.copytree(child, target)
                else:
                    shutil.copy2(child, target)
        else:
            shutil.copy2(source_path, payload_dir / source_path.name)

        return _walk_file_entries(payload_dir)

    def _write_version_manifest(self, version_dir: Path, manifest: dict[str, Any]) -> None:
        manifest_path = version_dir / "manifest.json"
        with manifest_path.open("w", encoding="utf-8") as stream:
            json.dump(manifest, stream, ensure_ascii=False, indent=2)

    def _bundle_payload(self, version_dir: Path, payload_dir: Path) -> str:
        bundle_path = version_dir / "bundle.tar.gz"
        with tarfile.open(bundle_path, "w:gz") as tar:
            tar.add(payload_dir, arcname="payload")
        return bundle_path.name

    def _build_manifest(
        self,
        *,
        model_name: str,
        model_slug: str,
        stage: StageType,
        version: str,
        notes: str | None,
        source_metadata: dict[str, Any],
        files: list[dict[str, Any]],
        bundle_name: str,
        standard_artifacts: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        ftp_paths = self._build_ftp_paths(
            stage=stage,
            model_slug=model_slug,
            version=version,
            bundle_name=bundle_name,
        )
        payload = {
            "modelName": model_name,
            "modelSlug": model_slug,
            "stage": stage,
            "version": version,
            "createdAt": _utc_now(),
            "notes": notes,
            "source": source_metadata,
            "files": files,
            "bundle": bundle_name,
            "ftpPaths": {
                "bundle": ftp_paths["bundle"],
                "manifest": ftp_paths["manifest"],
            },
        }
        if standard_artifacts:
            payload["standardArtifacts"] = standard_artifacts
        return payload

    def _build_version_entry(
        self,
        *,
        version: str,
        created_at: str,
        notes: str | None,
        source_metadata: dict[str, Any],
        bundle_path: str,
        manifest_path: str,
        standard_artifacts: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "version": version,
            "createdAt": created_at,
            "notes": notes,
            "bundle": bundle_path,
            "manifest": manifest_path,
            "source": source_metadata,
        }
        if standard_artifacts:
            payload["standardArtifacts"] = standard_artifacts
        return payload

    def _looks_like_state_dict(self, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        if not data:
            return False
        return all(isinstance(key, str) for key in data.keys()) and any(
            torch.is_tensor(value) for value in data.values()
        )

    def _discover_torch_payload_file(self, payload_dir: Path) -> Path | None:
        preferred = [
            "best_checkpoint.pth",
            "best_checkpoint.pt",
            "model.pth",
            "model.pt",
        ]
        for name in preferred:
            found = list(payload_dir.rglob(name))
            if found:
                return found[0]

        for extension in ("*.pth", "*.pt"):
            found = sorted(payload_dir.rglob(extension))
            if found:
                return found[0]
        return None

    def _build_torch_standard_payload(
        self,
        *,
        raw_checkpoint: Any,
        source_file_name: str,
        task_type: str | None,
        num_classes: int | None,
    ) -> dict[str, Any]:
        standardized: dict[str, Any]
        if isinstance(raw_checkpoint, torch.nn.Module):
            standardized = {
                "model_state_dict": raw_checkpoint.state_dict(),
                "task_type": task_type or "classification",
                "num_classes": num_classes,
            }
        elif isinstance(raw_checkpoint, dict):
            standardized = dict(raw_checkpoint)
            if "model_state_dict" in standardized and isinstance(standardized["model_state_dict"], dict):
                pass
            elif self._looks_like_state_dict(standardized):
                standardized = {
                    "model_state_dict": standardized,
                }
            else:
                raise ValueError(
                    "Unsupported .pth format. Expected state_dict or dict containing model_state_dict."
                )
            standardized.setdefault("task_type", task_type or "classification")
            if num_classes is not None:
                standardized["num_classes"] = num_classes
        else:
            raise ValueError("Unsupported .pth format. torch.load result must be nn.Module or dict.")

        if num_classes is not None and standardized.get("num_classes") is None:
            standardized["num_classes"] = num_classes

        standardized["standard_format"] = "void_torch_checkpoint_v1"
        standardized["source_file"] = source_file_name
        standardized["converted_at"] = _utc_now()
        return standardized

    def _maybe_generate_torch_standard(
        self,
        *,
        payload_dir: Path,
        stage: StageType,
        model_slug: str,
        version: str,
        convert_to_torch_standard: bool,
        torch_task_type: str | None,
        torch_num_classes: int | None,
    ) -> dict[str, str] | None:
        if not convert_to_torch_standard:
            return None

        source_file = self._discover_torch_payload_file(payload_dir)
        if source_file is None:
            raise FileNotFoundError("No .pth/.pt file found in payload for torch standard conversion")

        loaded = torch.load(str(source_file), map_location="cpu")
        standardized = self._build_torch_standard_payload(
            raw_checkpoint=loaded,
            source_file_name=source_file.name,
            task_type=torch_task_type,
            num_classes=torch_num_classes,
        )

        target = payload_dir / "model-standard.pt"
        torch.save(standardized, str(target))

        return {
            "pytorch": f"/{stage}/{model_slug}/versions/{version}/payload/model-standard.pt",
            "source": source_file.relative_to(payload_dir).as_posix(),
        }

    def _mlflow_artifact_candidates(self, artifact_path: str) -> list[str]:
        candidates: list[str] = [artifact_path]
        if artifact_path == "model":
            candidates.extend(
                [
                    "best_checkpoint.pt",
                    "checkpoints/best_checkpoint.pt",
                ]
            )

        deduped: list[str] = []
        for item in candidates:
            normalized = item.strip()
            if normalized and normalized not in deduped:
                deduped.append(normalized)
        return deduped

    def publish_from_local(
        self,
        *,
        model_name: str,
        stage: StageType,
        local_source_path: str,
        version: str | None,
        set_latest: bool,
        notes: str | None,
        source_metadata: dict[str, Any],
        convert_to_torch_standard: bool = False,
        torch_task_type: str | None = None,
        torch_num_classes: int | None = None,
    ) -> dict[str, Any]:
        source_path = Path(local_source_path).expanduser().resolve()
        if not source_path.exists():
            raise FileNotFoundError(f"Source path not found: {source_path}")

        with self._lock:
            index = self._read_index(stage, model_name)
            model_slug = self._model_slug(model_name)
            resolved_version = self._resolve_version(index, version)
            version_dir = self._model_dir(stage, model_name) / "versions" / resolved_version
            if version_dir.exists():
                raise ValueError(
                    f"Version already exists: stage={stage}, model={model_name}, version={resolved_version}"
                )

            payload_dir = version_dir / "payload"
            files = self._copy_payload(source_path, payload_dir)
            standard_artifacts = self._maybe_generate_torch_standard(
                payload_dir=payload_dir,
                stage=stage,
                model_slug=model_slug,
                version=resolved_version,
                convert_to_torch_standard=convert_to_torch_standard,
                torch_task_type=torch_task_type,
                torch_num_classes=torch_num_classes,
            )
            files = _walk_file_entries(payload_dir)
            bundle_name = self._bundle_payload(version_dir, payload_dir)
            manifest = self._build_manifest(
                model_name=model_name,
                model_slug=model_slug,
                stage=stage,
                version=resolved_version,
                notes=notes,
                source_metadata=source_metadata,
                files=files,
                bundle_name=bundle_name,
                standard_artifacts=standard_artifacts,
            )
            self._write_version_manifest(version_dir, manifest)

            versions = index.get("versions", [])
            versions.append(
                self._build_version_entry(
                    version=resolved_version,
                    created_at=str(manifest["createdAt"]),
                    notes=notes,
                    source_metadata=source_metadata,
                    bundle_path=str(manifest["ftpPaths"]["bundle"]),
                    manifest_path=str(manifest["ftpPaths"]["manifest"]),
                    standard_artifacts=standard_artifacts,
                )
            )
            index["versions"] = versions

            if set_latest or not index.get("latest"):
                index["latest"] = resolved_version

            self._write_index(stage, model_name, index)

        ftp_paths = self._build_ftp_paths(
            stage=stage,
            model_slug=model_slug,
            version=resolved_version,
            bundle_name=bundle_name,
        )
        return {
            "modelName": model_name,
            "stage": stage,
            "version": resolved_version,
            "latest": index.get("latest"),
            "ftpRoot": ftp_paths["root"],
            "bundlePath": ftp_paths["bundle"],
            "manifestPath": ftp_paths["manifest"],
            "latestPath": ftp_paths["latest"],
            "indexPath": ftp_paths["index"],
            "versionCount": len(index.get("versions", [])),
            "standardArtifactPath": standard_artifacts.get("pytorch") if standard_artifacts else None,
        }

    def publish_from_mlflow(
        self,
        *,
        model_name: str,
        stage: StageType,
        version: str | None,
        set_latest: bool,
        notes: str | None,
        tracking_uri: str,
        run_id: str,
        artifact_path: str,
        convert_to_torch_standard: bool = False,
        torch_task_type: str | None = None,
        torch_num_classes: int | None = None,
    ) -> dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="ftp-registry-") as temp_dir:
            local_source: str | None = None
            resolved_artifact_path: str | None = None
            errors: list[str] = []
            candidate_paths = self._mlflow_artifact_candidates(artifact_path)

            for candidate_path in candidate_paths:
                try:
                    local_source = download_artifact(
                        tracking_uri=tracking_uri,
                        run_id=run_id,
                        artifact_path=candidate_path,
                        destination_dir=temp_dir,
                    )
                    resolved_artifact_path = candidate_path
                    break
                except Exception as error:  # noqa: BLE001
                    errors.append(f"{candidate_path}: {error}")

            if local_source is None or resolved_artifact_path is None:
                attempted = ", ".join(candidate_paths)
                detail = "; ".join(errors[-2:]) if errors else "download failed"
                raise FileNotFoundError(
                    f"MLflow artifact not found for run_id={run_id}. "
                    f"attempted_paths=[{attempted}] details={detail}"
                )

            return self.publish_from_local(
                model_name=model_name,
                stage=stage,
                local_source_path=local_source,
                version=version,
                set_latest=set_latest,
                notes=notes,
                source_metadata={
                    "type": "mlflow",
                    "trackingUri": tracking_uri,
                    "runId": run_id,
                    "artifactPath": artifact_path,
                    "resolvedArtifactPath": resolved_artifact_path,
                },
                convert_to_torch_standard=convert_to_torch_standard,
                torch_task_type=torch_task_type,
                torch_num_classes=torch_num_classes,
            )

    def list_models(self, stage: StageType) -> list[dict[str, Any]]:
        stage_dir = self._stage_dir(stage)
        result: list[dict[str, Any]] = []

        for model_dir in sorted(stage_dir.iterdir()):
            if not model_dir.is_dir():
                continue
            index_path = model_dir / "index.json"
            if not index_path.exists():
                continue
            with index_path.open("r", encoding="utf-8") as stream:
                index = json.load(stream)

            result.append(
                {
                    "modelName": index.get("modelName", model_dir.name),
                    "stage": stage,
                    "latest": index.get("latest"),
                    "versionCount": len(index.get("versions", [])),
                    "updatedAt": index.get("updatedAt"),
                    "slug": model_dir.name,
                }
            )

        return result

    def get_model(self, stage: StageType, model_name: str) -> dict[str, Any]:
        index = self._read_index(stage, model_name)
        if not index.get("versions"):
            raise FileNotFoundError(f"No versions found: stage={stage}, model={model_name}")
        return index

    def resolve(self, stage: StageType, model_name: str, version: str = "latest") -> dict[str, Any]:
        index = self.get_model(stage, model_name)
        resolved_version = index.get("latest") if version in {"", "latest"} else self._version_slug(version)
        if not resolved_version:
            raise ValueError(f"No latest version for stage={stage}, model={model_name}")

        entry = next(
            (item for item in index.get("versions", []) if item.get("version") == resolved_version),
            None,
        )
        if entry is None:
            raise FileNotFoundError(
                f"Version not found: stage={stage}, model={model_name}, version={resolved_version}"
            )

        model_slug = self._model_slug(model_name)
        ftp_paths = self._build_ftp_paths(
            stage=stage,
            model_slug=model_slug,
            version=resolved_version,
            bundle_name="bundle.tar.gz",
        )
        return {
            "modelName": index.get("modelName", model_name),
            "stage": stage,
            "requestedVersion": version,
            "resolvedVersion": resolved_version,
            "latest": index.get("latest"),
            "bundlePath": ftp_paths["bundle"],
            "manifestPath": ftp_paths["manifest"],
            "latestPath": ftp_paths["latest"],
            "indexPath": ftp_paths["index"],
            "entry": entry,
        }

    def promote(
        self,
        *,
        model_name: str,
        from_stage: StageType,
        to_stage: StageType,
        version: str = "latest",
        target_version: str | None = None,
        set_latest: bool = True,
        notes: str | None = None,
    ) -> dict[str, Any]:
        if from_stage == to_stage:
            raise ValueError("from_stage and to_stage must be different")

        source = self.resolve(from_stage, model_name, version)
        source_version = source["resolvedVersion"]
        source_dir = (
            self._model_dir(from_stage, model_name)
            / "versions"
            / source_version
            / "payload"
        )

        return self.publish_from_local(
            model_name=model_name,
            stage=to_stage,
            local_source_path=str(source_dir),
            version=target_version,
            set_latest=set_latest,
            notes=notes,
            source_metadata={
                "type": "promotion",
                "fromStage": from_stage,
                "sourceVersion": source_version,
                "sourceBundle": source["bundlePath"],
            },
        )


settings = get_settings()
ftp_registry = FtpModelRegistry(settings.ftp_registry_root)
