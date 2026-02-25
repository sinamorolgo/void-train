from __future__ import annotations

import argparse
from pathlib import Path

from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer


def main() -> None:
    parser = argparse.ArgumentParser(description="Run local FTP server for model registry")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=2121)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root_dir = Path(args.root).expanduser().resolve()
    root_dir.mkdir(parents=True, exist_ok=True)

    authorizer = DummyAuthorizer()
    authorizer.add_user(args.username, args.password, str(root_dir), perm="elradfmwMT")

    handler = FTPHandler
    handler.authorizer = authorizer
    handler.banner = "Void Train Manager FTP Model Registry"

    server = FTPServer((args.host, args.port), handler)
    server.max_cons = 64
    server.max_cons_per_ip = 10
    server.serve_forever(timeout=0.5, blocking=True)


if __name__ == "__main__":
    main()
