# Gradio Standards

Detected via `gradio` in Python deps — runs as primary framework when it's the app's purpose.

## What Gradio Is

Python lib for building ML demo UIs in minutes. Drop a Python function in, get a web UI with inputs/outputs auto-rendered. Sister to Streamlit but optimized for ML demos (image, audio, video inputs).

## When to Use

- ML model demo / proof-of-concept
- Quick HuggingFace Spaces deployment
- Internal tool with image/audio/video I/O
- Public demo URLs (Gradio handles tunneling)

vs Streamlit: Gradio is **simpler for ML demos** (better default media handling, easier deploy to HF Spaces). Streamlit is better for dashboards.

## Setup

```bash
pip install gradio
```

## Hello World

```python
import gradio as gr

def greet(name: str) -> str:
    return f"Hello, {name}!"

demo = gr.Interface(fn=greet, inputs="text", outputs="text")
demo.launch()       # opens browser at localhost:7860
```

`gr.Interface` is the magic — pass a function + spec of inputs/outputs, get a UI.

## Input/Output Components

```python
# Text
gr.Textbox(label="Question", placeholder="Ask anything...")

# Numeric
gr.Number(value=42)
gr.Slider(minimum=0, maximum=100, value=50, step=1)

# Choice
gr.Dropdown(choices=["A", "B", "C"], value="A")
gr.Radio(choices=["yes", "no"])
gr.Checkbox(label="Enable")

# Media (Gradio's strength)
gr.Image(type="filepath")       # or "pil", "numpy"
gr.Audio(type="filepath")
gr.Video()
gr.File()

# Code
gr.Code(language="python")

# Data
gr.DataFrame()
gr.JSON()

# Outputs
gr.Label()                       # classification result
gr.Plot()                        # matplotlib/plotly
gr.Markdown()
gr.HighlightedText()             # NER-style highlighting
```

## Multi-Input / Multi-Output

```python
def classify_image(image, threshold: float):
    predictions = model.predict(image)
    label = predictions.argmax()
    confidence = predictions[label]
    return {label_names[i]: float(p) for i, p in enumerate(predictions)}, f"{confidence:.1%}"

demo = gr.Interface(
    fn=classify_image,
    inputs=[
        gr.Image(type="pil", label="Upload Image"),
        gr.Slider(0, 1, 0.5, label="Confidence Threshold"),
    ],
    outputs=[
        gr.Label(num_top_classes=5),
        gr.Textbox(label="Confidence"),
    ],
    examples=[["examples/cat.jpg", 0.5], ["examples/dog.jpg", 0.7]],
)

demo.launch()
```

`examples=` adds clickable sample inputs — great UX for demos.

## Blocks (Custom Layouts)

For more control, use `gr.Blocks`:

```python
with gr.Blocks() as demo:
    gr.Markdown("# Image Classifier")

    with gr.Row():
        with gr.Column():
            input_image = gr.Image(type="pil")
            threshold = gr.Slider(0, 1, 0.5, label="Threshold")
            classify_btn = gr.Button("Classify", variant="primary")
        with gr.Column():
            output_label = gr.Label(num_top_classes=5)
            output_text = gr.Textbox(label="Top prediction")

    classify_btn.click(
        fn=classify_image,
        inputs=[input_image, threshold],
        outputs=[output_label, output_text],
    )

    gr.Examples(examples=[["examples/cat.jpg"]], inputs=[input_image])

demo.launch()
```

`with gr.Row()` / `with gr.Column()` for layout. `.click()` wires up events.

## Streaming Outputs (Chat / Text Generation)

```python
def stream_chat(message: str, history: list):
    response = ""
    for token in model.stream(message):
        response += token
        yield response       # yield = streaming output

demo = gr.ChatInterface(fn=stream_chat)
demo.launch()
```

`yield` instead of `return` → Gradio streams updates. Critical for LLM apps.

## Chat Interface (LLM-ready)

```python
def respond(message, history):
    return f"You said: {message}"

demo = gr.ChatInterface(
    fn=respond,
    title="My Chatbot",
    description="Ask me anything",
    examples=["Hello", "How are you?"],
    type="messages",          # OpenAI-compatible message format
)
demo.launch()
```

Built-in: message history, streaming, retry, undo. Perfect for LLM demos.

## Deployment

### HuggingFace Spaces (Easiest)

```bash
# Spaces detects gradio automatically
# 1. Create new Space on huggingface.co
# 2. Push your code with app.py + requirements.txt
# 3. Spaces builds + serves for free
```

`README.md` with HF metadata:
```yaml
---
title: My Demo
emoji: 🦀
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 5.0.0
app_file: app.py
pinned: false
---
```

### Self-Host

```python
demo.launch(
    server_name="0.0.0.0",
    server_port=7860,
    share=False,                # True = gradio.live tunnel for public URL
    auth=("username", "password"),     # basic auth
)
```

Wrap in Docker, deploy to any container host.

## API Mode

Every Gradio app exposes a REST API automatically — `<your-app>/api/predict`:

```python
from gradio_client import Client

client = Client("https://your-space.hf.space")
result = client.predict("Hello", api_name="/predict")
```

Use Gradio as a quick API server for ML models.

## Themes

```python
demo = gr.Interface(
    fn=greet,
    inputs="text",
    outputs="text",
    theme=gr.themes.Soft(primary_hue="blue"),
    title="Pro Demo",
    css=".my-class { color: red; }",
)
```

Built-in themes: `Default`, `Soft`, `Monochrome`, `Glass`, `Citrus`. Or write your own.

## Best Practices

- **Use `gr.Blocks`** for anything beyond a single function — far more flexible
- **`gr.ChatInterface`** for LLM apps — built-in history + streaming
- **`yield`** for streaming outputs (text gen, progressive image processing)
- **`examples=`** on Interface — users love clickable samples
- **Cache results** for expensive operations: `gr.Interface(cache_examples=True)`
- **HF Spaces** for free public demos — auto-deploys from git
- **Type hints + docstrings** — Gradio uses them to infer UI types when possible

## Common Pitfalls

- Heavy model load in cell scope → loaded on every restart; cache at module level
- Forgetting `share=True` when wanting public URL → only localhost
- Public `share=True` URLs expire after 72h — use HF Spaces for permanent
- Returning wrong type from function → Gradio errors with "expected X, got Y"
- Mutable state in `gr.Interface` across users → use `gr.State` or `gr.Blocks` with explicit handling
- Big images / files exhausting RAM → set `cache_examples=False`, stream when possible

## When to Use What

| Use case | Tool |
|---|---|
| Quick ML demo, public URL | Gradio + HF Spaces |
| Internal data dashboard | Streamlit |
| Production-grade web app | FastAPI + React/Next.js |
| Notebook → static report | Quarto / nbconvert |

## Resources

- Docs: https://www.gradio.app/docs
- Guides: https://www.gradio.app/guides
- HF Spaces: https://huggingface.co/spaces
- gradio_client (API access): https://www.gradio.app/docs/python-client
