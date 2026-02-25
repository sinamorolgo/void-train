from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import torch

from app.core.train_config import PROGRESS_PREFIX, RUN_META_PREFIX


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def parse_primary_gpu_id(gpu_ids: str) -> int:
    first = gpu_ids.split(",")[0].strip()
    return int(first) if first else 0


def pick_device(*, gpu_ids: str, force_cpu: bool) -> torch.device:
    if force_cpu or not torch.cuda.is_available():
        return torch.device("cpu")

    gpu_index = parse_primary_gpu_id(gpu_ids)
    if gpu_index >= torch.cuda.device_count():
        return torch.device("cpu")

    return torch.device(f"cuda:{gpu_index}")


def emit_progress(payload: dict) -> None:
    print(f"{PROGRESS_PREFIX}{json.dumps(payload, ensure_ascii=False)}", flush=True)


def emit_run_meta(payload: dict) -> None:
    print(f"{RUN_META_PREFIX}{json.dumps(payload, ensure_ascii=False)}", flush=True)


def ensure_dirs(*paths: str) -> None:
    for path in paths:
        Path(path).expanduser().resolve().mkdir(parents=True, exist_ok=True)
