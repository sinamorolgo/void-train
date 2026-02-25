from __future__ import annotations

import argparse
import json

from app.services.tb_migration import import_tensorboard_scalars


def main() -> None:
    parser = argparse.ArgumentParser(description="Import TensorBoard scalars into MLflow")
    parser.add_argument("--tensorboard-dir", required=True)
    parser.add_argument("--tracking-uri", required=True)
    parser.add_argument("--experiment-name", required=True)
    parser.add_argument("--run-name", default="tb-import")
    args = parser.parse_args()

    result = import_tensorboard_scalars(
        tensorboard_dir=args.tensorboard_dir,
        tracking_uri=args.tracking_uri,
        experiment_name=args.experiment_name,
        run_name=args.run_name,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
