from __future__ import annotations

from ftplib import FTP
from pathlib import Path


def download_file_via_ftp(
    *,
    host: str,
    username: str,
    password: str,
    remote_path: str,
    destination_dir: str,
    port: int = 21,
    timeout: int = 15,
) -> str:
    target_dir = Path(destination_dir).expanduser().resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = Path(remote_path).name
    local_path = target_dir / filename

    with FTP() as ftp:
        ftp.connect(host=host, port=port, timeout=timeout)
        ftp.login(user=username, passwd=password)
        with local_path.open("wb") as output:
            ftp.retrbinary(f"RETR {remote_path}", output.write)

    return str(local_path)
