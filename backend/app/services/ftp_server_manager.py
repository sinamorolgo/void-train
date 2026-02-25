from __future__ import annotations

import subprocess
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.settings import get_settings
from app.services.process_utils import read_process_output, start_checked_process, stop_process


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


@dataclass
class FtpServerRecord:
    server_id: str
    host: str
    port: int
    username: str
    root_path: str
    started_at: str
    status: str = "running"
    pid: int | None = None
    finished_at: str | None = None
    last_error: str | None = None
    process: subprocess.Popen[str] | None = field(default=None, repr=False)

    def to_public(self) -> dict[str, Any]:
        return {
            "serverId": self.server_id,
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "rootPath": self.root_path,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "status": self.status,
            "pid": self.pid,
            "lastError": self.last_error,
        }


class FtpServerManager:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._servers: dict[str, FtpServerRecord] = {}

    def start_server(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        root_path: str,
    ) -> dict[str, Any]:
        script_path = self._settings.backend_root / "scripts" / "run_ftp_server.py"
        if not script_path.exists():
            raise FileNotFoundError(f"FTP server script not found: {script_path}")

        root_dir = Path(root_path).expanduser().resolve()
        root_dir.mkdir(parents=True, exist_ok=True)

        command = [
            sys.executable,
            str(script_path),
            "--host",
            host,
            "--port",
            str(port),
            "--username",
            username,
            "--password",
            password,
            "--root",
            str(root_dir),
        ]

        process = start_checked_process(
            command,
            startup_timeout_sec=1.0,
            error_prefix="Failed to start FTP server",
        )

        server_id = uuid.uuid4().hex
        record = FtpServerRecord(
            server_id=server_id,
            host=host,
            port=port,
            username=username,
            root_path=str(root_dir),
            started_at=_utc_now(),
            pid=process.pid,
            process=process,
        )
        self._servers[server_id] = record
        return record.to_public()

    def stop_server(self, server_id: str) -> dict[str, Any]:
        record = self._servers.get(server_id)
        if record is None:
            raise KeyError(f"FTP server not found: {server_id}")

        if record.process is not None and record.status == "running":
            stop_process(record.process, terminate_timeout_sec=8, kill_timeout_sec=3)

        record.status = "stopped"
        record.finished_at = _utc_now()
        return record.to_public()

    def list_servers(self) -> list[dict[str, Any]]:
        for record in self._servers.values():
            if record.process is not None and record.status == "running":
                if record.process.poll() is not None:
                    record.status = "exited"
                    record.finished_at = _utc_now()
                    combined = read_process_output(record.process, max_chars=5000)
                    if combined:
                        record.last_error = combined

        return [item.to_public() for item in self._servers.values()]


ftp_server_manager = FtpServerManager()
