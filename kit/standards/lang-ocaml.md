# OCaml Standards

OCaml is a multi-paradigm (functional-first) language with strong static types + powerful type inference. Industrial users: Jane Street, Discord (backend), Facebook (Flow, infer), Tezos, Coq. Detected via `dune-project` or `*.opam`.

## Toolchain

- **opam** — package manager
- **dune** — build system (modern standard)
- **utop** — REPL
- **ocaml-lsp** — language server for editor integration
- **ocamlformat** — auto-formatter

```bash
opam init
opam switch create 5.2.0       # set up an environment
eval $(opam env)
opam install dune utop ocaml-lsp-server ocamlformat
```

## Project Structure

```
my-project/
├── dune-project          # project metadata
├── bin/
│   └── dune              # executable build rules
│   └── main.ml
├── lib/
│   ├── dune              # library rules
│   └── my_lib.ml
└── test/
    └── dune
    └── test_my_lib.ml
```

`dune-project`:
```
(lang dune 3.0)
(name my_project)
```

`bin/dune`:
```
(executable
 (name main)
 (libraries my_lib))
```

`lib/dune`:
```
(library
 (name my_lib)
 (libraries str))
```

```bash
dune build
dune exec ./bin/main.exe
dune test
```

## Core Idioms

### Bindings + Functions

```ocaml
let x = 42
let y = x + 1

let add a b = a + b              (* no parens, no commas *)
let result = add 3 5

(* Multi-line *)
let factorial n =
  let rec aux acc n =
    if n <= 1 then acc
    else aux (acc * n) (n - 1)
  in
  aux 1 n
```

OCaml has **type inference** — annotations optional but encouraged on module boundaries.

### Pattern Matching

```ocaml
let describe = function
  | 0 -> "zero"
  | n when n < 0 -> "negative"
  | _ -> "positive"

let head = function
  | [] -> None
  | x :: _ -> Some x

(* Variants (sum types) *)
type shape =
  | Circle of float
  | Rectangle of float * float
  | Triangle of float * float * float

let area = function
  | Circle r -> Float.pi *. r *. r
  | Rectangle (w, h) -> w *. h
  | Triangle (a, b, c) ->
      let s = (a +. b +. c) /. 2.0 in
      sqrt (s *. (s -. a) *. (s -. b) *. (s -. c))
```

### Records

```ocaml
type user = {
  name : string;
  email : string;
  age : int;
}

let alice = { name = "Alice"; email = "a@b.com"; age = 30 }
let older = { alice with age = 31 }       (* functional update *)
```

### Modules

```ocaml
(* lib/user.ml *)
type t = { name: string; email: string }

let create ~name ~email = { name; email }
let to_string u = Printf.sprintf "%s <%s>" u.name u.email

(* Usage *)
let alice = User.create ~name:"Alice" ~email:"a@b.com"
print_endline (User.to_string alice)
```

`~name` is a **labeled argument** — caller writes `~name:"Alice"`.

### Functors (Parameterized Modules)

```ocaml
module type ORDERED = sig
  type t
  val compare : t -> t -> int
end

module MakeSet (Ord : ORDERED) = struct
  type elt = Ord.t
  type t = elt list
  let empty = []
  let add x s = if List.mem x s then s else x :: s
  (* ... *)
end

module IntSet = MakeSet (struct
  type t = int
  let compare = Int.compare
end)
```

OCaml's module system is one of its strengths — feels like generics on steroids.

### Options + Results

```ocaml
let safe_div a b =
  if b = 0 then None else Some (a / b)

let parse_int s =
  match int_of_string_opt s with
  | Some n -> Ok n
  | None -> Error ("not a number: " ^ s)
```

`option` (`Some` / `None`) replaces null. `result` (`Ok` / `Error`) for errors.

### Pipelines

```ocaml
let result =
  data
  |> List.filter (fun x -> x > 0)
  |> List.map (fun x -> x * 2)
  |> List.fold_left (+) 0
```

`|>` (pipe) and `@@` (reverse pipe — like Haskell's `$`).

## Operators (Mind the Float/Int Split)

OCaml is strict about numeric types — **no implicit conversion**:

```ocaml
1 + 2           (* int *)
1.0 +. 2.0      (* float — note the . *)
1 + 1.0         (* type error *)
float_of_int 1 +. 2.0
```

Strings use `^` not `+`:
```ocaml
"hello" ^ " " ^ "world"
```

## Common Libraries

- **Base** — Jane Street's stdlib replacement
- **Core** — extended stdlib (Jane Street)
- **Lwt** / **Async** — async/concurrency (pick one)
- **Dream** — modern web framework
- **Opium** — sinatra-like web framework
- **Cohttp** — HTTP client + server
- **Yojson** — JSON
- **Caqti** — DB access (works with Postgres, MySQL, SQLite)
- **Eio** — modern effect-based concurrency (OCaml 5+)
- **Mirage** — unikernels

## Effects (OCaml 5+)

OCaml 5 introduced **algebraic effects** — capability-based concurrency without futures/promises:

```ocaml
open Effect
open Effect.Deep

type _ Effect.t += Get : int Effect.t

let v = match_with (fun () -> perform Get + 1) ()
  { retc = (fun x -> x);
    exnc = raise;
    effc = fun (type a) (e : a Effect.t) -> match e with
      | Get -> Some (fun (k : (a, _) continuation) -> continue k 42)
      | _ -> None }
(* v = 43 *)
```

The **Eio** library uses effects for green-threading without `async`.

## Testing

- **Alcotest** — popular test framework
- **ppx_inline_test** + dune — inline tests in source

```ocaml
(* test/test_math.ml *)
let test_add () = Alcotest.(check int) "add" 5 (add 2 3)

let () =
  Alcotest.run "Math" [
    "addition", [ Alcotest.test_case "simple" `Quick test_add ]
  ]
```

## Best Practices

- **Use dune** for everything — modern standard
- **Format with `ocamlformat`** — set rules in `.ocamlformat`
- **Modules over classes** — OCaml has objects but they're rarely used
- **Prefer immutable data** — use `mutable` only when you have a reason
- **Labeled args** for readability: `~name`, `~id`
- **Newtype via `private`** abstract types: `module Id : sig type t val of_int : int -> t end`
- **Effects** (OCaml 5) over Lwt for new code (when ecosystem catches up)

## Common Pitfalls

- `1 + 1.0` → type error; use `+.` for floats, convert explicitly
- `"a" + "b"` → type error; strings use `^`
- Forgetting `;;` in REPL — necessary as statement terminator (not in files)
- Mutable refs (`ref`, `!`, `:=`) misused — keep refs scoped, prefer immutable
- Module too big without `*.mli` interface file → exposes internals
- Lwt vs Async + Effects → ecosystem split; pick early and stick to it

## Resources

- Docs: https://ocaml.org/docs
- Real World OCaml (book, free online): https://dev.realworldocaml.org
- OCaml Programming (textbook): https://cs3110.github.io/textbook
- opam packages: https://opam.ocaml.org/packages
- Discord: https://discord.gg/ocaml
- Discuss: https://discuss.ocaml.org
