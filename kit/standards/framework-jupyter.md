# Jupyter Standards

Detected via `jupyter`, `jupyterlab`, or `ipykernel` in Python deps — auto-injected as **extra**.

## When to Use

- Data exploration + analysis (interactive)
- ML experimentation (iterative model training, visualization)
- Teaching / documentation (mix prose, code, output)
- Reproducible reports (export to HTML/PDF)

**Not for**: production code, anything you'd put in `__main__.py`. Notebooks are for exploration; refactor to `.py` modules for prod.

## Setup Options

```bash
# Classic notebook
pip install notebook

# JupyterLab (recommended — modern IDE-like UI)
pip install jupyterlab

# VSCode interactive (also great)
# No setup; install Python + Jupyter extensions in VSCode
```

```bash
jupyter lab          # opens in browser
jupyter notebook
```

## Cell Types

- **Code** — Python (or other kernel)
- **Markdown** — formatted text, LaTeX (`$\sum x_i$`), tables, images
- **Raw** — no rendering (for nbconvert templates)

Shortcuts:
- `Shift+Enter` — run + next cell
- `Ctrl+Enter` — run + stay
- `Esc` then `M` — convert to markdown
- `Esc` then `Y` — convert to code
- `Esc` then `A` / `B` — insert cell above/below

## State Model (CRITICAL)

**Cells share global state.** Variables persist across cells. **Cell execution order matters but isn't enforced**.

```python
# Cell 1
x = 5

# Cell 2 (run BEFORE cell 1?)
print(x)        # NameError if cell 1 not run yet
```

Best practice: **run cells top-to-bottom** before sharing notebooks. Use **"Restart & Run All"** before committing.

## Magic Commands

```python
%timeit slow_function()         # time a line
%%timeit                          # time the whole cell

%load_ext autoreload
%autoreload 2                    # auto-reload imported modules on edit

%matplotlib inline                # render plots in notebook
%matplotlib widget                # interactive plots

%pip install package              # install in active kernel's env (use this, NOT !pip)

%%writefile myfile.py             # write cell contents to file
```

## Plotting

```python
%matplotlib inline
import matplotlib.pyplot as plt
import seaborn as sns

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(x, y)
ax.set_title("Sales over time")
plt.show()

# Interactive
%matplotlib widget       # then plt commands are zoomable/pannable

# Plotly (interactive by default)
import plotly.express as px
px.scatter(df, x="age", y="income", color="city")
```

## Display Rich Output

```python
from IPython.display import display, HTML, Markdown, Image, Audio

display(df.head())               # rich repr (HTML table)
display(HTML("<b>Bold</b>"))
display(Markdown("# Heading"))
display(Image(filename="img.png"))
```

Last expression in a cell auto-displays. For multiple displays, use `display()` explicitly.

## Widgets (Interactive UI)

```python
from ipywidgets import interact

@interact(threshold=(0, 100, 1))
def filter_data(threshold=50):
    filtered = df[df["score"] > threshold]
    display(filtered)
```

Drag a slider → notebook re-runs the function. Great for parameter exploration.

## nbconvert (Export)

```bash
jupyter nbconvert notebook.ipynb --to html
jupyter nbconvert notebook.ipynb --to pdf       # needs LaTeX
jupyter nbconvert notebook.ipynb --to python    # extract code as .py
jupyter nbconvert notebook.ipynb --execute --to html      # run + export
```

## Version Control Pain

Notebooks are JSON with embedded outputs — git diffs are noisy.

Solutions:
- **`jupyter nbconvert --to script`** before committing — version control the `.py` instead
- **nbstripout** — git pre-commit hook that strips outputs
- **jupytext** — pairs `.ipynb` with `.py` / `.md`, syncs automatically
- **Quarto** (`.qmd`) — modern alternative, plain text source

```bash
# nbstripout setup
pip install nbstripout
nbstripout --install         # configures git filters
```

## Papermill (Parameterized Notebooks)

```bash
papermill input.ipynb output.ipynb -p threshold 75 -p date 2026-01-01
```

Run a notebook with different parameters — useful for batch reports.

## Refactoring to Modules

Once notebook code stabilizes:

```python
# Cell 1: import from your module
%load_ext autoreload
%autoreload 2

from src.analysis import load_data, train_model, evaluate

# Cell 2: use it
df = load_data("data.csv")
model = train_model(df)
print(evaluate(model, df))
```

Edit `src/analysis.py` in your IDE; autoreload picks up changes without restart.

## Best Practices

- **"Restart & Run All"** before committing or sharing — proves the notebook reproduces
- **Number sections with markdown headers** — Jupyter shows a TOC
- **`%matplotlib inline`** at the top — consistent plot rendering
- **Extract reusable code** to `.py` modules; import them — keep notebook for exploration only
- **Pin versions** in `requirements.txt` or `environment.yml` — others can't reproduce on broken deps
- **nbstripout** or **jupytext** for git sanity
- **Quarto** if you want notebooks as code (not JSON)

## Common Pitfalls

- Running cells out of order → state inconsistent; restart kernel often
- Long-running cell + accidentally re-running → mutates state (e.g. doubles a list)
- Forgetting `plt.show()` (matplotlib) → blank cell output
- `!pip install` in env that differs from kernel → installed in wrong place; use `%pip` instead
- Committing notebook with sensitive data in outputs (API keys, PII) → use nbstripout
- Reused variable names across notebooks → restart fresh per session
- Notebooks larger than 10MB → git history bloat; strip outputs

## Production Patterns

Notebooks are **not** for prod. But these tools bridge notebook + prod:

- **Papermill** — run notebooks as scripts with parameters
- **Voila** — turn notebook into web app (read-only)
- **Streamlit / Gradio** — proper web UIs (see those rules)
- **Dagster / Airflow** — orchestrate notebook execution in pipelines

## Resources

- Jupyter: https://jupyter.org
- JupyterLab docs: https://jupyterlab.readthedocs.io
- IPython magic: https://ipython.readthedocs.io/en/stable/interactive/magics.html
- nbstripout: https://github.com/kynan/nbstripout
- Quarto: https://quarto.org
