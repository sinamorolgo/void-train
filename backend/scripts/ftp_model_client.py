from __future__ import annotations

import argparse
import json
from ftplib import FTP
from pathlib import Path


def _read_text(ftp: FTP, remote_path: str) -> str:
    chunks: list[bytes] = []
    ftp.retrbinary(f"RETR {remote_path}", chunks.append)
    return b"".join(chunks).decode("utf-8").strip()


def _download_file(ftp: FTP, remote_path: str, local_path: Path) -> None:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    with local_path.open("wb") as stream:
        ftp.retrbinary(f"RETR {remote_path}", stream.write)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download model bundle from FTP model registry")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=21)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--stage", choices=["dev", "release"], default="release")
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--version", default="latest")
    parser.add_argument("--destination-dir", default="./downloads")
    parser.add_argument("--print-index", action="store_true")
    args = parser.parse_args()

    model_slug = args.model_name.strip().lower().replace(" ", "-")
    base = f"/{args.stage}/{model_slug}"

    with FTP() as ftp:
        ftp.connect(host=args.host, port=args.port, timeout=15)
        ftp.login(user=args.username, passwd=args.password)

        if args.print_index:
            index_text = _read_text(ftp, f"{base}/index.json")
            print(index_text)
            return

        version = args.version
        if version == "latest":
            version = _read_text(ftp, f"{base}/LATEST")

        manifest_remote = f"{base}/versions/{version}/manifest.json"
        bundle_remote = f"{base}/versions/{version}/bundle.tar.gz"

        destination = Path(args.destination_dir).expanduser().resolve()
        destination.mkdir(parents=True, exist_ok=True)

        manifest_local = destination / f"{args.model_name}-{args.stage}-{version}.manifest.json"
        bundle_local = destination / f"{args.model_name}-{args.stage}-{version}.bundle.tar.gz"

        _download_file(ftp, manifest_remote, manifest_local)
        _download_file(ftp, bundle_remote, bundle_local)

        manifest = json.loads(manifest_local.read_text(encoding="utf-8"))
        print(
            json.dumps(
                {
                    "resolvedVersion": version,
                    "manifestPath": str(manifest_local),
                    "bundlePath": str(bundle_local),
                    "source": manifest.get("source"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
