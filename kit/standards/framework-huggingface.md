# HuggingFace Transformers Standards

Detected via `transformers` in Python deps — auto-injected as **extra**.

## What It Is

The de-facto library for transformer models — BERT, GPT-2/Neo/J, Llama, Mistral, Whisper, CLIP, Stable Diffusion (via diffusers), and 500k+ community models on the Hub.

## Setup

```bash
pip install transformers torch accelerate
# Optional but common:
pip install datasets peft bitsandbytes sentencepiece tokenizers safetensors
```

## Quick Inference (Pipelines)

The fastest path to using a model:

```python
from transformers import pipeline

# Text classification
classifier = pipeline("sentiment-analysis")
classifier("I love this!")   # → [{'label': 'POSITIVE', 'score': 0.999}]

# Summarization
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
summarizer("Long article text...", max_length=130, min_length=30)

# Translation
translator = pipeline("translation_en_to_fr")
translator("Hello, how are you?")

# QA
qa = pipeline("question-answering")
qa(question="What is HuggingFace?", context="HuggingFace is a company...")

# Image classification
imgcls = pipeline("image-classification", model="google/vit-base-patch16-224")
imgcls("path/to/image.jpg")

# Audio
asr = pipeline("automatic-speech-recognition", model="openai/whisper-base")
asr("audio.wav")
```

## Lower-Level: Tokenizer + Model

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_name = "meta-llama/Llama-3.1-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="auto",       # auto-distributes across GPUs
)

# Encode
inputs = tokenizer("Hello, world!", return_tensors="pt").to(model.device)

# Generate
outputs = model.generate(
    **inputs,
    max_new_tokens=256,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)

# Decode
text = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(text)
```

`Auto*` classes load the right class for the model (e.g. `AutoModelForCausalLM` → `LlamaForCausalLM`).

## Chat Templates

Modern models have built-in chat templates:

```python
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What's the capital of France?"},
]

prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=256)
```

Each model has its own template (Llama vs Mistral vs Phi differ). The tokenizer handles it.

## Quantization (Run Bigger Models on Smaller GPUs)

```python
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
)
```

4-bit quantization → 70B model runs on a single 48GB GPU instead of needing 140GB.

For prod: **GGUF / llama.cpp** for CPU inference, **vLLM** / **TGI** for GPU serving.

## Fine-Tuning (LoRA via PEFT)

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import TrainingArguments, Trainer

lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()        # only ~0.1% of params trained

trainer = Trainer(
    model=model,
    args=TrainingArguments(
        output_dir="./lora-out",
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        num_train_epochs=3,
        bf16=True,
        logging_steps=10,
        save_strategy="epoch",
    ),
    train_dataset=dataset,
    tokenizer=tokenizer,
)
trainer.train()
```

LoRA adds tiny "adapter" layers — fine-tune 7B models on a single 24GB GPU.

## Datasets

```python
from datasets import load_dataset

ds = load_dataset("squad")                # benchmark dataset
ds = load_dataset("json", data_files="my_data.jsonl")    # local
ds = load_dataset("parquet", data_files="data.parquet")

# Stream huge datasets without loading into RAM
ds = load_dataset("c4", "en", split="train", streaming=True)
for example in ds:
    print(example)
    break

# Map / filter / shuffle
ds = ds.map(lambda x: {"length": len(x["text"])})
ds = ds.filter(lambda x: x["length"] > 100)
ds = ds.shuffle(seed=42)

# Train/test split
ds = ds.train_test_split(test_size=0.1)
```

`datasets` is a separate library from `transformers` — pip install together.

## Embeddings (Sentence Transformers)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(["Hello world", "Another sentence"])
# embeddings.shape == (2, 384)
```

For RAG: pair with a vector DB (Pinecone, Qdrant, pgvector, Chroma).

## Hub: Save + Load Models

```python
# Save locally
model.save_pretrained("./my-model")
tokenizer.save_pretrained("./my-model")

# Push to Hub
model.push_to_hub("myorg/my-model")
tokenizer.push_to_hub("myorg/my-model")

# Load
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained("myorg/my-model")
```

```bash
huggingface-cli login          # set token first
```

## Diffusers (Image Generation)

```bash
pip install diffusers
```

```python
from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
).to("cuda")

image = pipe("A photo of an astronaut riding a horse").images[0]
image.save("output.png")
```

Same API style as `transformers`. For SDXL / Flux / video, swap the model name.

## Production Inference

For serving HF models in production:
- **Text Generation Inference (TGI)** — HF's optimized LLM server
- **vLLM** — fastest open-source LLM serving (PagedAttention)
- **llama.cpp** — CPU + GPU inference for quantized models (GGUF)
- **HuggingFace Inference Endpoints** — managed hosting (paid)
- **HuggingFace Inference API** — quick prototyping (free tier limited)

```python
# Inference API call (no model loading)
from huggingface_hub import InferenceClient

client = InferenceClient("meta-llama/Llama-3.1-8B-Instruct", token="hf_...")
response = client.text_generation("Tell me a joke", max_new_tokens=100)
```

## Best Practices

- **Auto* classes** (`AutoModel`, `AutoTokenizer`) — work across model families
- **`torch_dtype=torch.bfloat16`** — half memory, no accuracy loss vs fp16
- **`device_map="auto"`** — auto-distributes large models across GPUs
- **Quantization (4-bit, 8-bit)** — run bigger models on less hardware
- **LoRA via PEFT** for fine-tuning — orders of magnitude cheaper than full fine-tune
- **Use chat templates** via `tokenizer.apply_chat_template` — don't hand-format prompts
- **Pin model + library versions** — model weights and tokenizer behavior change
- **Read model cards on the Hub** — context length, training data, license

## Common Pitfalls

- OOM on 7B+ models → use quantization or smaller models
- Wrong dtype causing accuracy issues → bf16 > fp16 for stability
- Tokenizer mismatch with model → always load both from same name
- Forgetting `add_generation_prompt=True` in chat template → model can't tell it's its turn
- Slow generation → enable `model.generation_config.do_sample` only when needed; greedy is faster
- Old transformers version + new model → upgrade transformers regularly
- License violations — read the model card; many "open weights" models have commercial restrictions (Llama 3 community license, etc.)

## Resources

- Docs: https://huggingface.co/docs/transformers
- Model Hub: https://huggingface.co/models
- Course: https://huggingface.co/learn/nlp-course
- PEFT: https://huggingface.co/docs/peft
- diffusers: https://huggingface.co/docs/diffusers
- vLLM: https://docs.vllm.ai
