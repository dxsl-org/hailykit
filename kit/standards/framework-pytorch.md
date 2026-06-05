# PyTorch Standards

Detected via `torch` in Python deps — auto-injected as **extra**.

## When to Use

- Deep learning research + production (most popular DL framework in 2026)
- Need eager execution + Pythonic debugging
- Custom architectures, novel research
- Cross-platform deployment (PyTorch + TorchScript + ExecuTorch)

## Tensors

```python
import torch

# Create
x = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
zeros = torch.zeros(3, 4)
randn = torch.randn(2, 3)
arr = torch.arange(0, 10)

# Device (GPU)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# or: "mps" for Apple Silicon
x = x.to(device)

# Operations
y = x @ x.T              # matrix multiplication
z = x.mean(dim=0)
shape = x.shape
```

## Modules (nn.Module)

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, num_classes: int):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, num_classes)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        return self.fc2(x)

model = MLP(784, 256, 10).to(device)
```

`nn.Module` auto-tracks parameters. Override `forward()`; never call it directly — use `model(x)` (calls `__call__` which sets up hooks).

## Training Loop

```python
import torch.optim as optim
from torch.utils.data import DataLoader

dataloader = DataLoader(dataset, batch_size=64, shuffle=True, num_workers=4)
optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
criterion = nn.CrossEntropyLoss()

for epoch in range(10):
    model.train()
    for batch_x, batch_y in dataloader:
        batch_x, batch_y = batch_x.to(device), batch_y.to(device)

        optimizer.zero_grad()             # CRITICAL — clear previous gradients
        outputs = model(batch_x)
        loss = criterion(outputs, batch_y)
        loss.backward()                    # compute gradients
        optimizer.step()                   # apply

    # Validation
    model.eval()
    with torch.no_grad():
        # ... compute val loss
```

**Always** `optimizer.zero_grad()` before `loss.backward()` — PyTorch accumulates gradients by default.

## Data Pipeline

```python
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T

class ImageDataset(Dataset):
    def __init__(self, paths, labels, transform=None):
        self.paths = paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = load_image(self.paths[idx])
        if self.transform:
            img = self.transform(img)
        return img, self.labels[idx]

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
```

`num_workers=4` in DataLoader for parallel data loading (4 worker processes).

## Mixed Precision (Speed + Memory)

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()

for batch_x, batch_y in dataloader:
    optimizer.zero_grad()
    with autocast(device_type="cuda"):
        outputs = model(batch_x)
        loss = criterion(outputs, batch_y)

    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

Mixed precision (FP16/BF16 forward, FP32 master weights) → 2-3x speedup on modern GPUs, half the memory.

## Model Save / Load

```python
# Save
torch.save(model.state_dict(), "model.pt")
torch.save({
    "model": model.state_dict(),
    "optimizer": optimizer.state_dict(),
    "epoch": epoch,
}, "checkpoint.pt")

# Load
model.load_state_dict(torch.load("model.pt", weights_only=True))
model.eval()

# Resume training
ckpt = torch.load("checkpoint.pt", weights_only=True)
model.load_state_dict(ckpt["model"])
optimizer.load_state_dict(ckpt["optimizer"])
start_epoch = ckpt["epoch"] + 1
```

Always pass `weights_only=True` to `torch.load` — safer (no arbitrary pickle code execution).

## Inference

```python
model.eval()
with torch.no_grad():       # disable autograd — faster, less memory
    outputs = model(x)
    predictions = outputs.argmax(dim=1)
```

For production: export to TorchScript or ONNX for portable deployment:
```python
scripted = torch.jit.script(model)
scripted.save("model.pt")
```

## torch.compile (Speedup)

```python
model = torch.compile(model)     # JIT compile for 1.5-3x speedup
```

PyTorch 2.0+. Works best on fixed input shapes — set `mode="reduce-overhead"` for inference, `"max-autotune"` for max throughput.

## Distributed Training

```python
# DDP (Distributed Data Parallel) — multi-GPU
import torch.distributed as dist

dist.init_process_group("nccl")
model = torch.nn.parallel.DistributedDataParallel(model, device_ids=[local_rank])

# Sampler must be DistributedSampler so each GPU sees a different shard
sampler = torch.utils.data.distributed.DistributedSampler(dataset)
dataloader = DataLoader(dataset, batch_size=64, sampler=sampler)
```

Launch with `torchrun --nproc_per_node=8 train.py` for 8 GPUs.

For very large models: **FSDP** (Fully Sharded Data Parallel) or libraries like **Accelerate** / **Lightning**.

## Lightning + Accelerate (Higher-Level)

For less boilerplate:
- **PyTorch Lightning** — trainer abstracts training loop, callbacks, DDP, etc.
- **Hugging Face Accelerate** — minimal wrapper that handles device + distributed setup

```python
# Lightning
import lightning as L

class LitMLP(L.LightningModule):
    def training_step(self, batch, batch_idx):
        x, y = batch
        loss = nn.functional.cross_entropy(self(x), y)
        return loss

trainer = L.Trainer(max_epochs=10, accelerator="gpu", devices=8, strategy="ddp")
trainer.fit(model, dataloader)
```

## Best Practices

- **Move data + model to same device** before forward — explicit `.to(device)`
- **`model.train()` / `model.eval()`** toggles dropout + batchnorm behavior — set explicitly
- **`with torch.no_grad():`** for inference + validation — saves memory, speeds up
- **Gradient clipping** for stability: `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)`
- **Set seeds** for reproducibility: `torch.manual_seed(42)`, `torch.cuda.manual_seed_all(42)`
- **Tensorboard** or **wandb** for experiment tracking
- **DataLoader `num_workers > 0`** + `pin_memory=True` for faster GPU transfers
- Pin PyTorch + CUDA versions explicitly — version mismatches cause subtle bugs

## Common Pitfalls

- Forgetting `optimizer.zero_grad()` → gradients accumulate, training explodes
- Forgetting `.to(device)` on data → "Expected all tensors to be on the same device"
- Mixing `model.train()` / `model.eval()` modes → dropout/batchnorm behavior wrong
- Loading checkpoint trained on GPU, running on CPU → use `map_location` in `torch.load`
- Large batch in eval → OOM; use `torch.no_grad()` + smaller eval batch
- Slow training? Check `num_workers`, GPU utilization (`nvidia-smi`), batch size scaling
- Stale Python files imported from notebook → restart kernel; modules don't auto-reload

## Resources

- Docs: https://pytorch.org/docs
- Tutorials: https://pytorch.org/tutorials
- Lightning: https://lightning.ai/docs/pytorch
- HF Accelerate: https://huggingface.co/docs/accelerate
- Awesome PyTorch: https://github.com/bharathgs/Awesome-pytorch-list
