from __future__ import annotations

from pathlib import Path

import mlflow
import torch
import torch.nn.functional as F
from torch.optim import Adam
from torch.utils.tensorboard import SummaryWriter

from app.core.train_config import SegmentationTrainConfig, build_arg_parser, config_to_dict
from trainers.common import emit_progress, emit_run_meta, ensure_dirs, pick_device, set_seed
from trainers.models import create_model


def dice_loss(logits: torch.Tensor, targets: torch.Tensor, num_classes: int, eps: float = 1e-6) -> torch.Tensor:
    probs = torch.softmax(logits, dim=1)
    one_hot = F.one_hot(targets.long(), num_classes=num_classes).permute(0, 3, 1, 2).float()

    intersection = torch.sum(probs * one_hot, dim=(2, 3))
    denominator = torch.sum(probs + one_hot, dim=(2, 3))
    dice_score = (2 * intersection + eps) / (denominator + eps)
    return 1.0 - dice_score.mean()


def mean_iou(logits: torch.Tensor, targets: torch.Tensor, num_classes: int, eps: float = 1e-6) -> float:
    preds = torch.argmax(logits, dim=1)
    ious: list[float] = []

    for cls in range(num_classes):
        pred_mask = preds == cls
        target_mask = targets == cls
        intersection = torch.logical_and(pred_mask, target_mask).sum().item()
        union = torch.logical_or(pred_mask, target_mask).sum().item()
        ious.append(float(intersection + eps) / float(union + eps))

    return float(sum(ious) / max(len(ious), 1))


def evaluate(
    model: torch.nn.Module,
    *,
    num_batches: int,
    batch_size: int,
    input_height: int,
    input_width: int,
    num_classes: int,
    dice_weight: float,
    ce_weight: float,
    device: torch.device,
) -> tuple[float, float]:
    model.eval()

    total_loss = 0.0
    total_iou = 0.0

    with torch.no_grad():
        for _ in range(num_batches):
            images = torch.randn(batch_size, 1, input_height, input_width, device=device)
            masks = torch.randint(0, num_classes, (batch_size, input_height, input_width), device=device)

            logits = model(images)
            loss_ce = F.cross_entropy(logits, masks)
            loss_dice = dice_loss(logits, masks, num_classes=num_classes)
            total_loss += float(ce_weight * loss_ce + dice_weight * loss_dice)
            total_iou += mean_iou(logits, masks, num_classes)

    return total_loss / num_batches, total_iou / num_batches


def train(config: SegmentationTrainConfig) -> None:
    ensure_dirs(config.output_root, config.checkpoint_dir, config.tensorboard_dir)

    set_seed(config.seed)
    device = pick_device(gpu_ids=config.gpu_ids, force_cpu=config.force_cpu)

    model = create_model("segmentation", config.num_classes).to(device)
    optimizer = Adam(model.parameters(), lr=config.learning_rate)
    scaler = torch.cuda.amp.GradScaler(enabled=(config.use_amp and device.type == "cuda"))

    run_dir = Path(config.output_root).expanduser().resolve()
    checkpoint_dir = Path(config.checkpoint_dir).expanduser().resolve()
    tb_dir = Path(config.tensorboard_dir).expanduser().resolve() / config.run_name
    writer = SummaryWriter(log_dir=str(tb_dir))

    mlflow.set_tracking_uri(config.mlflow_tracking_uri)
    mlflow.set_experiment(config.mlflow_experiment)

    best_val_iou = -1.0
    best_checkpoint_path = checkpoint_dir / "best_checkpoint.pt"

    with mlflow.start_run(run_name=config.run_name) as run:
        emit_run_meta({"mlflow_run_id": run.info.run_id, "task_type": "segmentation"})

        params = config_to_dict(config)
        params["task_type"] = "segmentation"
        mlflow.log_params(params)

        for epoch in range(1, config.epochs + 1):
            model.train()
            running_loss = 0.0

            for _ in range(config.steps_per_epoch):
                images = torch.randn(
                    config.batch_size,
                    1,
                    config.input_height,
                    config.input_width,
                    device=device,
                )
                masks = torch.randint(
                    0,
                    config.num_classes,
                    (config.batch_size, config.input_height, config.input_width),
                    device=device,
                )

                optimizer.zero_grad(set_to_none=True)
                with torch.cuda.amp.autocast(enabled=(config.use_amp and device.type == "cuda")):
                    logits = model(images)
                    loss_ce = F.cross_entropy(logits, masks)
                    loss_dice = dice_loss(logits, masks, num_classes=config.num_classes)
                    loss = config.ce_weight * loss_ce + config.dice_weight * loss_dice

                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()

                running_loss += float(loss.item())

            train_loss = running_loss / config.steps_per_epoch
            val_loss, val_iou = evaluate(
                model,
                num_batches=max(2, config.steps_per_epoch // 2),
                batch_size=config.batch_size,
                input_height=config.input_height,
                input_width=config.input_width,
                num_classes=config.num_classes,
                dice_weight=config.dice_weight,
                ce_weight=config.ce_weight,
                device=device,
            )

            writer.add_scalar("train/loss", train_loss, epoch)
            writer.add_scalar("val/loss", val_loss, epoch)
            writer.add_scalar("val/iou", val_iou, epoch)

            mlflow.log_metrics(
                {
                    "train_loss": train_loss,
                    "val_loss": val_loss,
                    "val_iou": val_iou,
                },
                step=epoch,
            )

            checkpoint = {
                "epoch": epoch,
                "task_type": "segmentation",
                "num_classes": config.num_classes,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": params,
                "metric": {"val_iou": val_iou, "val_loss": val_loss},
            }

            if epoch % config.save_every == 0:
                epoch_ckpt = checkpoint_dir / f"epoch_{epoch}.pt"
                torch.save(checkpoint, epoch_ckpt)
                mlflow.log_artifact(str(epoch_ckpt), artifact_path="checkpoints")

            if val_iou > best_val_iou:
                best_val_iou = val_iou
                torch.save(checkpoint, best_checkpoint_path)

            emit_progress(
                {
                    "task_type": "segmentation",
                    "epoch": epoch,
                    "total_epochs": config.epochs,
                    "train_loss": round(train_loss, 5),
                    "val_loss": round(val_loss, 5),
                    "val_iou": round(val_iou, 5),
                    "best_val_iou": round(best_val_iou, 5),
                    "device": str(device),
                }
            )

        torch.save(
            {
                "task_type": "segmentation",
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
    parser = build_arg_parser(SegmentationTrainConfig)
    args = parser.parse_args()
    config = SegmentationTrainConfig(**vars(args))
    train(config)
