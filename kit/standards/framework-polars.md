# Polars Standards

Detected via `polars` in Python deps — auto-injected as **extra**.

## What Polars Is

Rust-backed DataFrame library — drop-in alternative to pandas with:
- **5-10x faster** on most workloads (multi-threaded, vectorized via Apache Arrow)
- **Lazy execution** — query optimizer fuses operations
- **Cleaner API** — no SettingWithCopyWarning, explicit expressions
- **Strong typing** — column types are explicit, not inferred per operation

## When to Use vs Pandas

| Use Polars when | Use Pandas when |
|---|---|
| Large datasets (>1M rows) | Tiny datasets (<10K rows) |
| Performance matters | Massive ecosystem support needed (legacy libs) |
| Greenfield project | Existing pandas codebase |
| Streaming / lazy needs | Quick interactive exploration |

## Eager vs Lazy

```python
import polars as pl

# Eager — runs immediately
df = pl.read_csv("data.csv")
result = df.filter(pl.col("age") >= 18).select(["name", "age"])

# Lazy — builds plan, runs when collect() called
lazy = pl.scan_csv("data.csv")
result = (
    lazy
    .filter(pl.col("age") >= 18)
    .select(["name", "age"])
    .collect()                # NOW it runs, with full query optimization
)
```

Lazy mode optimizes (predicate pushdown, projection pruning) — use for production pipelines. Eager for exploration.

## Core Operations

```python
# Create
df = pl.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "age": [30, 25, 35],
    "city": ["NY", "LA", "NY"],
})

# Inspect
df.head()
df.describe()
df.schema             # {'name': Utf8, 'age': Int64, 'city': Utf8}
df.shape
df.columns

# Read / Write
df = pl.read_parquet("data.parquet")
df = pl.read_csv("data.csv")
df = pl.read_database_uri("SELECT * FROM users", "postgresql://...")
df.write_parquet("out.parquet")
```

## Expressions (The Polars Way)

Polars uses **expressions** — composable column transformations via `pl.col(...)`:

```python
# Filter
df.filter(pl.col("age") >= 18)
df.filter((pl.col("age") >= 18) & (pl.col("city") == "NY"))

# Select / Transform
df.select(
    pl.col("name"),
    pl.col("age"),
    (pl.col("age") * 12).alias("age_in_months"),
    pl.when(pl.col("age") >= 18).then(pl.lit("adult")).otherwise(pl.lit("minor")).alias("tier"),
)

# Modify in place (not really — returns new df)
df = df.with_columns(
    (pl.col("age") * 12).alias("age_in_months"),
    pl.col("name").str.to_uppercase().alias("name_upper"),
)
```

## Aggregation

```python
df.group_by("city").agg(
    pl.col("age").mean().alias("avg_age"),
    pl.col("age").max().alias("max_age"),
    pl.len().alias("count"),
)

# Multiple groups
df.group_by(["city", "category"]).agg(pl.col("revenue").sum())
```

## Joins

```python
joined = df1.join(df2, on="user_id", how="left")
joined = df1.join(df2, left_on="id", right_on="user_id", how="inner")

# Asof join (time-series)
joined = df1.join_asof(df2, on="timestamp", strategy="backward")
```

## String Operations

```python
df.with_columns(
    pl.col("email").str.to_lowercase(),
    pl.col("email").str.contains("@example.com").alias("is_corporate"),
    pl.col("email").str.split("@").list.get(0).alias("username"),
    pl.col("name").str.replace_all(r"\s+", "_").alias("slug"),
)
```

Use `.str.*` namespace for string ops, `.dt.*` for datetimes, `.list.*` for list cols.

## Datetime

```python
df.with_columns(
    pl.col("created_at").dt.year().alias("year"),
    pl.col("created_at").dt.weekday().alias("weekday"),
    (pl.col("ended_at") - pl.col("started_at")).alias("duration"),
)

# Parse
df.with_columns(
    pl.col("date_str").str.strptime(pl.Date, "%Y-%m-%d"),
)
```

## Window Functions

```python
df.with_columns(
    pl.col("revenue").sum().over("city").alias("city_total"),
    pl.col("age").rank().over("city").alias("rank_in_city"),
)
```

Equivalent to SQL `PARTITION BY city` — no group_by collapse, attaches per-row.

## Streaming (Out-of-Core Data)

```python
# Process files larger than RAM
result = (
    pl.scan_csv("huge.csv")
    .filter(pl.col("year") == 2025)
    .group_by("category")
    .agg(pl.col("revenue").sum())
    .collect(streaming=True)        # process in chunks
)
```

`streaming=True` enables chunk-by-chunk processing — works on multi-GB files.

## SQL Interface

```python
ctx = pl.SQLContext(users=df1, posts=df2)
result = ctx.execute("""
    SELECT u.name, COUNT(p.id) AS post_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    GROUP BY u.name
""").collect()
```

Run SQL on DataFrames — handy for team members more comfortable with SQL.

## Best Practices

- **Default to lazy** for ETL pipelines — `pl.scan_*` + `.collect()` at the end
- **Use expressions** (`pl.col(...)`) — readable + composable
- **`with_columns()` for additions**, `select()` for replacements
- **Parquet over CSV** — typed columns, much faster
- **Strict typing** — pass `schema=` or `dtype=` to readers when types are known
- **`pl.scan_csv()` + `streaming=True`** for files larger than RAM
- For interop with pandas: `df.to_pandas()` / `pl.from_pandas(pdf)`

## Common Pitfalls

- Mixing eager + lazy confusedly → run `.collect()` to materialize
- `.with_columns()` returns new DataFrame — must assign back
- Using `df["col"]` (pandas style) → less efficient than `df.select(pl.col("col"))`
- Forgetting `.alias()` on expressions → result column has cryptic auto-name
- Calling Polars from inside pandas operations → context-switch cost; pick one
- Joins on differently-typed columns → silent miss; check `df.schema` first

## Performance Tips

- **Lazy** > eager whenever possible
- **`select()` early** to drop unused cols — projection pushdown helps the engine
- **Filter early** for predicate pushdown
- **Set `n_threads`** if working in a constrained env; default = all cores
- **`scan_*` over `read_*`** — defers I/O until needed
- For repeated queries on the same file: convert to parquet first, scan from there

## Resources

- Docs: https://docs.pola.rs
- Python API: https://docs.pola.rs/api/python/stable/reference/index.html
- Modern Polars (book): https://kevinheavey.github.io/modern-polars
- GitHub: https://github.com/pola-rs/polars
