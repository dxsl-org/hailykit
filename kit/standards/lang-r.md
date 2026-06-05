# R Standards

R for statistics, data analysis, visualization, reproducible research. Detected via `DESCRIPTION` file (CRAN package) or `*.Rproj`.

## Project Layout

```
my_project/
├── DESCRIPTION          # If it's a package
├── NAMESPACE
├── R/                   # Function definitions
├── data/                # *.RData / *.rds files
├── tests/testthat/      # testthat unit tests
├── vignettes/           # Long-form documentation
├── inst/                # Misc files installed with the package
└── man/                 # Auto-generated docs from roxygen2
```

For analysis projects (not packages): `analysis.Rmd`, `data/`, `R/utils.R`, `output/`.

## Tidyverse vs Base R

Two main idioms:

**Base R**:
```r
df <- read.csv("data.csv")
subset(df, age > 18 & income > 50000)
aggregate(income ~ city, data = df, FUN = mean)
```

**Tidyverse** (more modern, more readable):
```r
library(dplyr)
library(tidyr)

df |> 
  filter(age > 18, income > 50000) |> 
  group_by(city) |> 
  summarise(avg_income = mean(income))
```

`|>` is the native pipe (R 4.1+). Older code uses `%>%` from magrittr. Both work; native is preferred for new code.

## Core Data Structures

- **Vector** — homogeneous 1D: `c(1, 2, 3)` or `c("a", "b")`
- **List** — heterogeneous: `list(name = "Alice", age = 30, scores = c(85, 92))`
- **Data frame** — tabular: rows = observations, cols = variables
- **Tibble** — modern data frame (tidyverse): better printing, stricter type handling
- **Matrix** — 2D homogeneous: `matrix(1:12, nrow = 3)`
- **Factor** — categorical: `factor(c("low", "high", "low"))`

## Indexing (1-based!)

```r
v <- c(10, 20, 30)
v[1]        # 10
v[c(1, 3)]  # 10, 30
v[v > 15]   # 20, 30 (logical indexing)
v[-1]       # 20, 30 (negative = exclude)

df[1, ]              # first row
df[, "name"]          # name column
df[df$age > 18, ]     # rows where age > 18
df$age                # column access
```

## Functions

```r
add <- function(a, b = 0) {
  a + b
}

add(5)        # 5 (b defaults)
add(5, 3)     # 8

# Anonymous: \(x) x^2 (R 4.1+) or function(x) x^2

# Apply family (vectorized iteration)
sapply(1:5, \(x) x^2)              # → c(1, 4, 9, 16, 25)
lapply(c("a", "b"), nchar)          # → list(1, 1)

# Or purrr (tidyverse alternative)
library(purrr)
map_int(1:5, \(x) x^2)              # type-safe map
```

## dplyr — Data Manipulation

```r
library(dplyr)

# Single-table verbs
df |> filter(age > 18)                                  # rows
df |> select(name, age)                                  # cols
df |> mutate(age_in_months = age * 12)                   # add cols
df |> arrange(desc(income))                              # sort
df |> distinct(city)                                     # unique values
df |> summarise(mean_age = mean(age, na.rm = TRUE))      # aggregate
df |> group_by(city) |> summarise(n = n(), avg = mean(income))

# Joins
inner_join(df1, df2, by = "user_id")
left_join(df1, df2, by = c("a" = "b"))
```

## ggplot2 — Visualization

```r
library(ggplot2)

ggplot(df, aes(x = age, y = income, color = city)) +
  geom_point(alpha = 0.5) +
  geom_smooth(method = "lm") +
  labs(title = "Income by Age", x = "Age", y = "Income (USD)") +
  theme_minimal()
```

`+` chains layers. `aes()` maps data columns to visual properties. ggplot is the standard for publication-quality plots.

## Statistical Models

```r
# Linear regression
model <- lm(income ~ age + education, data = df)
summary(model)
predict(model, newdata = new_df)

# Generalized linear (e.g. logistic)
log_model <- glm(churned ~ age + spend, data = df, family = binomial)

# Time series
ts_data <- ts(monthly_sales, frequency = 12, start = c(2020, 1))
forecast::auto.arima(ts_data)
```

## R Markdown / Quarto

Reproducible reports mixing prose, code, output:

```r
---
title: "Sales Report"
output: html_document
---

# Summary

Total sales for Q1: `r format(sum(df$sales), big.mark = ",")`

```{r, echo = FALSE}
ggplot(df, aes(month, sales)) + geom_col()
```
```

Quarto (`*.qmd`) is the modern replacement for `*.Rmd` — supports Python + Julia in same doc.

## Testing (testthat)

```r
library(testthat)

test_that("add returns sum of two numbers", {
  expect_equal(add(2, 3), 5)
  expect_error(add("a", 1))
})

# Run all tests
testthat::test_dir("tests/testthat")
```

## Best Practices

- **Tidyverse** for new code unless package is base-R purist
- Use **renv** for reproducible package versions (per-project lockfile)
- **roxygen2** for function docs — `#' @param x ...` comments → generated `man/*.Rd`
- Prefer `|>` (native pipe, R 4.1+) over `%>%` for new code
- Use `tibble` over `data.frame` in tidyverse code
- Vectorize over for-loops — much faster
- `na.rm = TRUE` in aggregates if NAs expected — otherwise result is NA

## Common Pitfalls

- `T` and `F` are NOT reserved — can be reassigned! Use `TRUE` / `FALSE`
- `stringsAsFactors = FALSE` was the default fix pre-R 4.0; now default is `FALSE`
- 1-based indexing — off-by-one when porting from Python/JS
- `data.frame()` auto-strips list columns; use `tibble()` to preserve
- `library(x)` is fine in scripts; package code should use `requireNamespace("x")` + `x::function()`
- For-loops are slow — use vectorized ops or `apply`/`map_*`

## Resources

- R for Data Science (book, free online): https://r4ds.hadley.nz
- Advanced R (book): https://adv-r.hadley.nz
- CRAN: https://cran.r-project.org
- tidyverse: https://www.tidyverse.org
- ggplot2 ref: https://ggplot2.tidyverse.org
- Posit (formerly RStudio): https://posit.co
