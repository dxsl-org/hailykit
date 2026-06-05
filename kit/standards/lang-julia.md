# Julia Standards

Julia is a high-level, high-performance dynamic language for technical computing — scientific computing, ML, data analysis, optimization. Detected via `Project.toml` + `Manifest.toml`.

## Core Philosophy

- **Just-in-time compiled** to native code via LLVM — close to C speed
- **Multiple dispatch** is the central paradigm (not OOP, not pure FP)
- **Numerical-first** — arrays, math, broadcasting are built into the language
- **Two-language problem solver** — write prototypes and prod code in same language

## Project Structure

```
MyProject/
├── Project.toml         # Package metadata + dependencies
├── Manifest.toml         # Lockfile (resolved versions) — commit it
├── src/
│   └── MyProject.jl     # Main module
└── test/
    └── runtests.jl
```

```bash
julia --project=.        # activate this project's env
] add DataFrames CSV     # `]` enters package mode
] test
] update
```

## Types + Multiple Dispatch

```julia
struct Point
    x::Float64
    y::Float64
end

# Multiple dispatch: same function name, different methods per type
area(p::Point) = π * p.x^2          # treat as radius
area(r::Real) = π * r^2
area(w::Real, h::Real) = w * h

area(Point(2.0, 3.0))
area(5.0)
area(3.0, 4.0)
```

The function called depends on the **types of ALL arguments** — not just the first (OOP).

## Common Idioms

```julia
# Vectorized ops (broadcasting with `.`)
x = [1, 2, 3, 4]
y = x .^ 2              # element-wise: [1, 4, 9, 16]
z = sin.(x)              # apply sin element-wise

# Comprehensions
squares = [i^2 for i in 1:10 if i % 2 == 0]

# Pipe
result = data |> filter(x -> x > 0) |> sum

# Named tuples
user = (name="Alice", age=30)
user.name

# Multiple return + destructuring
function divmod(a, b)
    a ÷ b, a % b
end
q, r = divmod(10, 3)
```

## Packages

Top ecosystem libraries:
- **DataFrames.jl** — tabular data (like pandas)
- **CSV.jl**, **Arrow.jl** — file I/O
- **Plots.jl**, **Makie.jl** — plotting
- **Flux.jl** — neural networks
- **DifferentialEquations.jl** — ODE/SDE/PDE solvers (best-in-class)
- **JuMP.jl** — mathematical optimization
- **Distributions.jl** — probability distributions

## Performance

- **First call is slow** (JIT compile); subsequent calls are fast
- Use **type-stable** functions — types should be inferrable
- Avoid global variables in hot loops — pass as args
- Use `@inbounds` to skip bounds checks (after profiling)
- Profile with `@profile` + `ProfileView` or `BenchmarkTools.jl` `@btime`

```julia
using BenchmarkTools
@btime sum(rand(1000))      # microbenchmark
```

## Notebooks

- **Pluto.jl** — reactive notebooks (cells re-run on change)
- **IJulia** — Jupyter kernel

## Best Practices

- Pin dependencies via `Project.toml` + `Manifest.toml` — commit both
- Write **type-stable** functions (use `@code_warntype` to check)
- Prefer **broadcasting** (`.+`) over loops for clarity + speed
- Use **multiple dispatch** instead of OOP-style inheritance
- Document with docstrings + Documenter.jl
- Pin Julia version in CI

## Common Pitfalls

- Slow first call confused for slow code → run twice when benchmarking
- Type-unstable functions → 10-100x slower; check with `@code_warntype`
- `global` variables for performance → wrap hot code in functions
- Forgetting to activate project (`--project=.`) → uses global env
- Mutable structs when immutable would do — affects perf

## Resources

- Docs: https://docs.julialang.org
- Pluto: https://plutojl.org
- Julia Academy (free): https://juliaacademy.com
- Discourse: https://discourse.julialang.org
