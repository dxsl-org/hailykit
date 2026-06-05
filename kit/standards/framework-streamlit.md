# Streamlit Standards

Detected via `streamlit` in `requirements.txt` / `pyproject.toml` / `Pipfile`.

## What Streamlit Is

Streamlit turns Python scripts into interactive web apps with minimal code — no HTML, CSS, JS needed. Targets: data scientists, ML engineers, internal dashboards.

## When to Use

- Internal dashboards / admin tools
- ML model demos (upload → predict → visualize)
- Data exploration UIs
- Quick prototypes before building a "real" app
- Reports with interactive filters

**Not for:** customer-facing production apps, anything needing fine-grained UX control, real-time multiplayer features.

## Setup

```bash
pip install streamlit
```

```python
# app.py
import streamlit as st

st.title("My Dashboard")
name = st.text_input("Your name")
if name:
    st.write(f"Hello, {name}!")
```

```bash
streamlit run app.py
```

## Core Mental Model

**The entire script re-runs top to bottom on every interaction.** Streamlit caches widget values via their position/key. Don't think "events" — think "stateful re-render".

```python
import streamlit as st

count = st.session_state.get('count', 0)
if st.button('Increment'):
    count += 1
    st.session_state.count = count
st.write(f"Count: {count}")
```

## Layout

```python
# Sidebar
with st.sidebar:
    option = st.selectbox("Choose", ["A", "B", "C"])

# Columns
col1, col2, col3 = st.columns(3)
with col1: st.metric("Users", 1234)
with col2: st.metric("Revenue", "$5,678")
with col3: st.metric("Errors", 12, delta=-3)

# Tabs
tab1, tab2 = st.tabs(["Chart", "Data"])
with tab1: st.line_chart(df)
with tab2: st.dataframe(df)

# Expander
with st.expander("Show details"):
    st.write("...")
```

## Widgets

```python
text = st.text_input("Text")
num = st.number_input("Number", min_value=0, max_value=100, value=50)
date = st.date_input("Date")
choice = st.selectbox("Pick", ["A", "B"])
multi = st.multiselect("Multi", ["A", "B", "C"])
slider = st.slider("Value", 0, 100, 50)
toggle = st.toggle("Enable feature")
file = st.file_uploader("Upload CSV", type=['csv'])
```

Each widget returns its current value — read it after the widget call.

## Caching (Critical for Performance)

```python
import streamlit as st
import pandas as pd

@st.cache_data(ttl=3600)
def load_data(path: str) -> pd.DataFrame:
    return pd.read_csv(path)

@st.cache_resource
def load_model():
    return joblib.load('model.pkl')
```

- `@st.cache_data` — for serializable returns (DataFrames, dicts, lists). Recomputes if args change.
- `@st.cache_resource` — for unhashable/expensive resources (ML models, DB connections). Returns same instance.

**Always cache slow operations** — without it, every interaction re-runs them.

## Session State

```python
# Initialize once
if 'history' not in st.session_state:
    st.session_state.history = []

if st.button('Add'):
    st.session_state.history.append(time.now())

st.write(st.session_state.history)
```

Persists across reruns within the same user session.

## Charts

```python
# Built-in (Altair-based)
st.line_chart(df)
st.bar_chart(df)
st.area_chart(df)
st.map(geo_df)               # lat/lon DataFrame

# Plotly
import plotly.express as px
fig = px.scatter(df, x='x', y='y')
st.plotly_chart(fig, use_container_width=True)

# Altair (custom)
import altair as alt
chart = alt.Chart(df).mark_circle().encode(x='x', y='y', color='category')
st.altair_chart(chart, use_container_width=True)

# Matplotlib (works but slower)
fig, ax = plt.subplots()
ax.plot([1, 2, 3])
st.pyplot(fig)
```

## Forms (Batched Inputs)

By default, every widget change reruns the script. Forms batch inputs until submit:

```python
with st.form("user_form"):
    name = st.text_input("Name")
    email = st.text_input("Email")
    submitted = st.form_submit_button("Submit")

if submitted:
    save_user(name, email)
    st.success("Saved!")
```

## File Uploads

```python
file = st.file_uploader("Upload CSV", type=['csv'])
if file:
    df = pd.read_csv(file)
    st.dataframe(df)
```

For large files, use `accept_multiple_files=True` + process in chunks.

## Multi-Page Apps

```
my_app/
├── streamlit_app.py        # Main entry
└── pages/
    ├── 1_📊_Dashboard.py    # /Dashboard
    ├── 2_📈_Analytics.py    # /Analytics
    └── 3_⚙️_Settings.py     # /Settings
```

Streamlit auto-creates a sidebar nav from the `pages/` folder. Use emojis + numbers for ordering.

## Authentication

Streamlit Community Cloud has OAuth (Google, GitHub) built-in for hosted apps. For self-hosted:
- `streamlit-authenticator` — username/password with hashed creds
- Reverse-proxy in front (nginx + OAuth proxy) for SSO
- Cloudflare Access for zero-trust auth

## Deployment

- **Streamlit Community Cloud** (free) — push to GitHub, auto-deploy
- **Snowflake Streamlit** — for Snowflake-bound dashboards
- **Self-hosted**: `streamlit run app.py --server.port 8501` behind nginx/Caddy
- **Docker**: official `streamlit` image, expose port 8501

## Best Practices

- **Cache everything slow** — data loads, model inference, DB queries
- Use `st.form` to batch related inputs — prevents reruns on every keystroke
- Move slow init code to `@st.cache_resource` (DB pool, model load)
- `st.session_state` for cross-rerun state — don't rely on module-level vars
- Use columns + sidebar for layout — not raw HTML hacks
- Keep widget keys explicit (`key="user_email"`) for predictable session_state

## Common Pitfalls

- Forgetting cache → every interaction recomputes everything → slow
- Mutating `st.session_state` inside a cached function → cache thinks input hasn't changed
- Using module-level globals for state → lost on rerun
- File upload + heavy processing without progress bar → users think app is frozen
- Long-running tasks in main thread → consider async + `st.status` for progress
- Trying to make Streamlit do customer-facing apps → wrong tool; use FastAPI + React

## Resources

- Docs: https://docs.streamlit.io
- Component gallery: https://streamlit.io/components
- Cheat sheet: https://docs.streamlit.io/library/cheatsheet
- Community Cloud: https://streamlit.io/cloud
