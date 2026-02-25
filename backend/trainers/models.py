from __future__ import annotations

import torch
from torch import nn


class TinyClassifier(nn.Module):
    def __init__(self, num_classes: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.float()
        return self.net(x)


class TinySegmenter(nn.Module):
    def __init__(self, num_classes: int) -> None:
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )
        self.decoder = nn.Sequential(
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, num_classes, kernel_size=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.decoder(self.encoder(x.float()))


def create_model(task_type: str, num_classes: int) -> nn.Module:
    if task_type == "classification":
        return TinyClassifier(num_classes=num_classes)
    if task_type == "segmentation":
        return TinySegmenter(num_classes=num_classes)
    raise ValueError(f"Unsupported task type: {task_type}")
