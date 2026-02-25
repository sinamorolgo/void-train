from __future__ import annotations

import random
from pathlib import Path

import mlflow
import torch
import torch.nn.functional as F
from torch.optim import Adam
from torch.utils.tensorboard import SummaryWriter

from app.core.train_config import ClassificationTrainConfig, build_arg_parser, config_to_dict
from trainers.common import emit_progress, emit_run_meta, ensure_dirs, pick_device, set_seed
from trainers.models import create_model


def evaluate(
    model: torch.nn.Module,
    *,
    num_batches: int,
    batch_size: int,
    image_size: int,
    num_classes: int,
    device: torch.device,
) -> tuple[float, float]:
    model.eval()

    total_loss = 0.0
    total_correct = 0
    total_samples = 0

    with torch.no_grad():
        for _ in range(num_batches):
            images = torch.randn(batch_size, 1, image_size, image_size, device=device)
            labels = torch.randint(0, num_classes, (batch_size,), device=device)
            logits = model(images)
            loss = F.cross_entropy(logits, labels)
            preds = torch.argmax(logits, dim=1)
            total_correct += (preds == labels).sum().item()
            total_samples += labels.numel()
            total_loss += float(loss.item())

    return total_loss / num_batches, total_correct / max(total_samples, 1)


def train(config: ClassificationTrainConfig) -> None:
    ensure_dirs(config.output_root, config.checkpoint_dir, config.tensorboard_dir)

    set_seed(config.seed)
    device = pick_device(gpu_ids=config.gpu_ids, force_cpu=config.force_cpu)

    model = create_model("classification", config.num_classes).to(device)
    optimizer = Adam(model.parameters(), lr=config.learning_rate)
    scaler = torch.cuda.amp.GradScaler(enabled=(config.use_amp and device.type == "cuda"))

    run_dir = Path(config.output_root).expanduser().resolve()
    checkpoint_dir = Path(config.checkpoint_dir).expanduser().resolve()
    tb_dir = Path(config.tensorboard_dir).expanduser().resolve() / config.run_name
    writer = SummaryWriter(log_dir=str(tb_dir))

    mlflow.set_tracking_uri(config.mlflow_tracking_uri)
    mlflow.set_experiment(config.mlflow_experiment)

    best_val_accuracy = -1.0
    best_checkpoint_path = checkpoint_dir / "best_checkpoint.pt"

    with mlflow.start_run(run_name=config.run_name) as run:
        emit_run_meta({"mlflow_run_id": run.info.run_id, "task_type": "classification"})

        params = config_to_dict(config)
        params["task_type"] = "classification"
        mlflow.log_params(params)

        for epoch in range(1, config.epochs + 1):
            model.train()
            running_loss = 0.0
            running_correct = 0
            running_samples = 0

            for _ in range(config.steps_per_epoch):
                inputs = torch.randn(config.batch_size, 1, config.image_size, config.image_size, device=device)
                targets = torch.randint(0, config.num_classes, (config.batch_size,), device=device)

                optimizer.zero_grad(set_to_none=True)

                with torch.cuda.amp.autocast(enabled=(config.use_amp and device.type == "cuda")):
                    logits = model(inputs)
                    loss = F.cross_entropy(logits, targets)

                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()

                preds = torch.argmax(logits, dim=1)
                running_correct += (preds == targets).sum().item()
                running_samples += targets.numel()
                running_loss += float(loss.item())

            train_loss = running_loss / config.steps_per_epoch
            train_accuracy = running_correct / max(running_samples, 1)
            val_loss, val_accuracy = evaluate(
                model,
                num_batches=max(2, config.steps_per_epoch // 2),
                batch_size=config.batch_size,
                image_size=config.image_size,
                num_classes=config.num_classes,
                device=device,
            )

            writer.add_scalar("train/loss", train_loss, epoch)
            writer.add_scalar("train/accuracy", train_accuracy, epoch)
            writer.add_scalar("val/loss", val_loss, epoch)
            writer.add_scalar("val/accuracy", val_accuracy, epoch)

            mlflow.log_metrics(
                {
                    "train_loss": train_loss,
                    "train_accuracy": train_accuracy,
                    "val_loss": val_loss,
                    "val_accuracy": val_accuracy,
                },
                step=epoch,
            )

            checkpoint = {
                "epoch": epoch,
                "task_type": "classification",
                "num_classes": config.num_classes,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": params,
                "metric": {"val_accuracy": val_accuracy, "val_loss": val_loss},
            }

            if epoch % config.save_every == 0:
                epoch_ckpt = checkpoint_dir / f"epoch_{epoch}.pt"
                torch.save(checkpoint, epoch_ckpt)
                mlflow.log_artifact(str(epoch_ckpt), artifact_path="checkpoints")

            if val_accuracy > best_val_accuracy:
                best_val_accuracy = val_accuracy
                torch.save(checkpoint, best_checkpoint_path)

            progress_noise = random.uniform(-0.0005, 0.0005)
            emit_progress(
                {
                    "task_type": "classification",
                    "epoch": epoch,
                    "total_epochs": config.epochs,
                    "train_loss": round(train_loss, 5),
                    "train_accuracy": round(train_accuracy, 5),
                    "val_loss": round(val_loss, 5),
                    "val_accuracy": round(val_accuracy + progress_noise, 5),
                    "best_val_accuracy": round(best_val_accuracy, 5),
                    "device": str(device),
                }
            )

        torch.save(
            {
                "task_type": "classification",
                "num_classes": config.num_classes,
                "model_state_dict": model.state_dict(),
                "config": params,
            },
            run_dir / "final_checkpoint.pt",
        )

        if best_checkpoint_path.exists():
            mlflow.log_artifact(str(best_checkpoint_path), artifact_path="best")

        try:
            mlflow.pytorch.log_model(
                model,
                artifact_path="model",
                code_paths=[str(Path(__file__).resolve().parents[1])],
            )
        except Exception as error:  # noqa: BLE001
            print(f"[warn] mlflow.pytorch.log_model failed: {error}", flush=True)

    writer.close()


if __name__ == "__main__":
    parser = build_arg_parser(ClassificationTrainConfig)
    args = parser.parse_args()
    config = ClassificationTrainConfig(**vars(args))
    train(config)
