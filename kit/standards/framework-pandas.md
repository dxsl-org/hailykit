# Pandas Standards

Detected via `pandas` in Python deps — auto-injected as **extra**.

## Core Concepts

- **Series**: 1D labeled array (column)
- **DataFrame**: 2D table (rows × columns) — the workhorse
- **Index**: row labels (default = integer position 0..n-1, but can be anything)

```python
import pandas as pd
import numpy as np

# Create
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "age": [30, 25, 35],
    "city": ["NY", "LA", "NY"],
})

# Read
df = pd.read_csv("data.csv")
df = pd.read_parquet("data.parquet")    # FASTER + smaller than CSV
df = pd.read_json("data.json")
```

## Inspection

```python
df.head(10)               # first 10 rows
df.tail()                 # last 5
df.info()                  # dtypes + nulls + memory
df.describe()              # summary stats
df.shape                   # (rows, cols)
df.columns                 # column names
df.dtypes                  # types
df.isna().sum()            # null count per column
```

## Selection

```python
# Columns
df["age"]                  # Series
df[["name", "age"]]         # DataFrame

# Rows by position
df.iloc[0]                 # first row
df.iloc[0:5]                # first 5 rows
df.iloc[:, 0]               # first column

# Rows by label
df.loc[0, "name"]
df.loc[df["age"] > 25]      # boolean indexing

# Combined
df.loc[df["city"] == "NY", "name"]
```

**Always use `.loc` / `.iloc` for assignment** — chained indexing (`df[a][b] = ...`) silently fails.

## Filtering

```python
adults = df[df["age"] >= 18]

# Multiple conditions — wrap each in ()
ny_adults = df[(df["age"] >= 18) & (df["city"] == "NY")]

# Multiple values
ny_la = df[df["city"].isin(["NY", "LA"])]

# Negation
not_ny = df[~(df["city"] == "NY")]

# Null filtering
no_age = df[df["age"].isna()]
has_age = df[df["age"].notna()]
```

## Transformation

```python
# New column
df["age_in_months"] = df["age"] * 12
df["category"] = np.where(df["age"] >= 18, "adult", "minor")

# Conditional via apply (slower than vectorized)
df["tier"] = df["age"].apply(lambda a: "senior" if a > 60 else "junior")

# Vectorized string ops
df["name_upper"] = df["name"].str.upper()
df["first_initial"] = df["name"].str[0]

# Datetime
df["created_at"] = pd.to_datetime(df["created_at"])
df["year"] = df["created_at"].dt.year
df["dayname"] = df["created_at"].dt.day_name()
```

**Prefer vectorized ops over `.apply()` with lambdas** — 10-100x faster.

## Aggregation

```python
df.groupby("city")["age"].mean()
df.groupby("city").agg({"age": "mean", "name": "count"})

# Multiple agg per col
df.groupby("city").agg(
    avg_age=("age", "mean"),
    count=("age", "count"),
    max_age=("age", "max"),
)

# Pivot
df.pivot_table(index="city", columns="category", values="age", aggfunc="mean")
```

## Merge / Join

```python
# SQL-style join
merged = pd.merge(users, posts, on="user_id", how="left")
merged = pd.merge(users, posts, left_on="id", right_on="user_id")

# Concat
combined = pd.concat([df1, df2], ignore_index=True)        # rows
combined = pd.concat([df1, df2], axis=1)                    # cols
```

## Handling Missing Data

```python
df.dropna()                              # drop rows with any NaN
df.dropna(subset=["age"])                 # drop only if `age` is NaN
df.fillna(0)                              # replace all NaN with 0
df["age"].fillna(df["age"].median())      # impute with median
df.interpolate()                          # linear interpolation
```

## I/O Best Practices

```python
# Parquet > CSV — typed columns, smaller, faster
df.to_parquet("data.parquet", compression="snappy")
df = pd.read_parquet("data.parquet")

# Chunked reading for huge files
for chunk in pd.read_csv("huge.csv", chunksize=100_000):
    process(chunk)

# dtype hints prevent type inference overhead
df = pd.read_csv("data.csv", dtype={"id": "int32", "name": "string"})
```

## Performance Tips

- **Use parquet** over CSV — typed + smaller + 5-10x faster I/O
- **Vectorize** — avoid `.apply()` and `for` loops
- **Set `dtype`** explicitly — `category` for low-cardinality strings (massive memory savings)
- **`pd.to_datetime(s, format=...)`** with format hint — skips auto-detection
- **`merge` with sorted indexes** — much faster than unsorted
- **Drop unused columns** early — saves memory across pipeline
- **`df.eval("a + b")`** for arithmetic on large DataFrames — avoids intermediate allocations

## Alternatives for Big Data

When pandas hurts (>10M rows or out-of-memory):
- **Polars** — Rust-backed, multi-threaded, dramatically faster (see `framework-polars.md`)
- **DuckDB** — embedded analytical DB, SQL on parquet/CSV without loading into RAM
- **Dask** — distributed pandas-like API
- **Modin** — drop-in pandas replacement, uses Ray/Dask under the hood

```python
# DuckDB on parquet
import duckdb
result = duckdb.query("""
    SELECT city, AVG(age) AS avg_age
    FROM 'data.parquet'
    WHERE age >= 18
    GROUP BY city
""").to_df()
```

## Common Pitfalls

- **Chained indexing**: `df[df.age > 18]["name"] = "x"` → SettingWithCopyWarning + silent no-op; use `.loc[]`
- Forgetting parens around `&` / `|` — operator precedence bug
- `df.append()` is deprecated → use `pd.concat([df1, df2])`
- Mixing `iloc` (position) and `loc` (label) carelessly — different results when index ≠ position
- Saving CSV without `index=False` → extra unnamed column on reload
- `inplace=True` is being deprecated — assign back: `df = df.dropna()` instead of `df.dropna(inplace=True)`
- Loading 10GB CSV with default `dtype` → memory blows up; use chunked or parquet

## Resources

- Docs: https://pandas.pydata.org/docs
- 10-minute intro: https://pandas.pydata.org/docs/user_guide/10min.html
- Cookbook: https://pandas.pydata.org/docs/user_guide/cookbook.html
- Pyjanitor (chainable cleaning): https://pyjanitor-devs.github.io/pyjanitor
