from __future__ import annotations

import os
import subprocess
from typing import Mapping


def build_pythonpath_env(*, prepend_path: str, base_env: Mapping[str, str] | None = None) -> dict[str, str]:
    env = dict(base_env or os.environ)
    current_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        f"{prepend_path}{os.pathsep}{current_pythonpath}" if current_pythonpath else prepend_path
    )
    return env


def read_process_output(process: subprocess.Popen[str], *, max_chars: int = 5000) -> str:
    stderr_output = process.stderr.read() if process.stderr else ""
    stdout_output = process.stdout.read() if process.stdout else ""
    text = (stderr_output or stdout_output).strip()
    return text[-max_chars:] if text else ""


def start_checked_process(
    command: list[str],
    *,
    env: Mapping[str, str] | None = None,
    cwd: str | None = None,
    startup_timeout_sec: float = 1.0,
    error_prefix: str = "Failed to start process",
) -> subprocess.Popen[str]:
    process = subprocess.Popen(
        command,
        env=dict(env) if env is not None else None,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        process.wait(timeout=startup_timeout_sec)
    except subprocess.TimeoutExpired:
        pass

    if process.poll() is not None:
        details = read_process_output(process) or "unknown startup error"
        raise RuntimeError(f"{error_prefix}: {details}")

    return process


def stop_process(process: subprocess.Popen[str], *, terminate_timeout_sec: float = 8.0, kill_timeout_sec: float = 3.0) -> None:
    process.terminate()
    try:
        process.wait(timeout=terminate_timeout_sec)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=kill_timeout_sec)
