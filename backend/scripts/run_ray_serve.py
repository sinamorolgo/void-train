from __future__ import annotations

import argparse
import signal
import threading
from typing import Any

import mlflow.pyfunc
import ray
from fastapi import FastAPI, HTTPException
from ray import serve

app = FastAPI()


def _to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}

    to_list = getattr(value, "tolist", None)
    if callable(to_list):
        return _to_jsonable(to_list())

    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return _to_jsonable(to_dict(orient="records"))
        except TypeError:
            return _to_jsonable(to_dict())

    return str(value)


@serve.deployment
@serve.ingress(app)
class MlflowPyfuncDeployment:
    def __init__(self, model_uri: str) -> None:
        self._model = mlflow.pyfunc.load_model(model_uri)

    @app.get("/ping")
    def ping(self) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/invocations")
    def invocations(self, payload: dict[str, Any]) -> dict[str, Any]:
        if "inputs" not in payload:
            raise HTTPException(status_code=400, detail="inputs field is required")

        try:
            prediction = self._model.predict(payload["inputs"])
        except Exception as error:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"Model prediction failed: {error}") from error

        return {"predictions": _to_jsonable(prediction)}


def _route_prefix(value: str) -> str:
    route_prefix = value.strip()
    if not route_prefix:
        return "/"
    if route_prefix == "/":
        return route_prefix
    return route_prefix if route_prefix.startswith("/") else f"/{route_prefix}"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Ray Serve app for an MLflow model URI")
    parser.add_argument("--model-uri", required=True, help="MLflow model URI")
    parser.add_argument("--host", default="0.0.0.0", help="Ray Serve HTTP host")
    parser.add_argument("--port", type=int, default=7001, help="Ray Serve HTTP port")
    parser.add_argument("--app-name", default="void-train-manager", help="Ray Serve app name")
    parser.add_argument("--route-prefix", default="/", help="Ray Serve route prefix")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    stop_event = threading.Event()

    def _handle_signal(_signum: int, _frame: Any) -> None:
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    ray.init(ignore_reinit_error=True, include_dashboard=False, logging_level="ERROR")
    serve.start(http_options={"host": args.host, "port": args.port})
    serve.run(
        MlflowPyfuncDeployment.bind(args.model_uri),
        name=args.app_name.strip() or "void-train-manager",
        route_prefix=_route_prefix(args.route_prefix),
    )

    try:
        stop_event.wait()
    finally:
        serve.shutdown()
        ray.shutdown()


if __name__ == "__main__":
    main()
