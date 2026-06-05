# Haskell Standards

Purely functional, lazy, strongly-typed. Detected via `*.cabal`, `stack.yaml`, `package.yaml`.

## Toolchain

- **GHC** — the compiler
- **Cabal** — package manager + build tool (modern: cabal v2-commands)
- **Stack** — alternative build tool with curated package sets (LTS)
- **GHCup** — install all of the above

Most teams pick **either Stack or Cabal**, not both:
- **Cabal** for library development + flexibility
- **Stack** for app development + reproducibility

## Project Setup

```bash
# Cabal
cabal init --interactive
cabal build
cabal run

# Stack
stack new my-project
stack build
stack run
```

```
my-project/
├── my-project.cabal      # or package.yaml (Stack)
├── stack.yaml             # if Stack
├── src/
│   └── Lib.hs
├── app/
│   └── Main.hs
└── test/
    └── Spec.hs
```

## Core Idioms

### Type Signatures Everywhere

```haskell
-- Top-level fns should have explicit type signatures
add :: Int -> Int -> Int
add x y = x + y

-- Type classes for polymorphism (like interfaces)
sum :: Num a => [a] -> a
sum = foldr (+) 0
```

### Pattern Matching

```haskell
factorial :: Int -> Int
factorial 0 = 1
factorial n = n * factorial (n - 1)

describe :: Maybe Int -> String
describe Nothing  = "no value"
describe (Just n) = "got " ++ show n

-- Guards
classify :: Int -> String
classify n
    | n < 0     = "negative"
    | n == 0    = "zero"
    | otherwise = "positive"
```

### Algebraic Data Types

```haskell
data Shape
    = Circle Double
    | Rectangle Double Double
    | Triangle Double Double Double
    deriving (Show, Eq)

area :: Shape -> Double
area (Circle r)        = pi * r * r
area (Rectangle w h)    = w * h
area (Triangle a b c)   = let s = (a + b + c) / 2
                          in sqrt (s * (s-a) * (s-b) * (s-c))
```

### Records

```haskell
data User = User
    { userName  :: String
    , userEmail :: String
    , userAge   :: Int
    } deriving (Show)

alice = User { userName = "Alice", userEmail = "a@b.com", userAge = 30 }

-- Update (creates new record)
older = alice { userAge = 31 }
```

### Maybe + Either

```haskell
-- Replace null with Maybe
findUser :: Int -> Maybe User
findUser 1 = Just alice
findUser _ = Nothing

-- Either for errors
parseAge :: String -> Either String Int
parseAge s = case reads s :: [(Int, String)] of
    [(n, "")] | n >= 0 -> Right n
    _                   -> Left ("invalid: " ++ s)
```

### Do Notation (IO + Monads)

```haskell
main :: IO ()
main = do
    putStrLn "What's your name?"
    name <- getLine
    putStrLn ("Hello, " ++ name)
```

`do` is syntactic sugar for `>>=` (bind). It works for any monad, not just IO.

### Higher-Order Functions

```haskell
map :: (a -> b) -> [a] -> [b]
filter :: (a -> Bool) -> [a] -> [a]
foldr :: (a -> b -> b) -> b -> [a] -> b

-- Composition
processData = sum . filter even . map (* 2)
processData [1..10]      -- 60
```

## Common Libraries

- **base** — Prelude + core types (always available)
- **text** — efficient strings (use `Text` not `String` in production)
- **bytestring** — binary data
- **aeson** — JSON
- **mtl** — monad transformers
- **transformers** — base for mtl
- **lens** — composable getters/setters for records
- **servant** — type-level REST API definitions
- **persistent** — DB layer (works with multiple backends)
- **warp** — HTTP server (used by yesod, scotty, servant)
- **scotty** — Sinatra-like web framework (lightweight)
- **yesod** — full-stack web framework (heavier)
- **stm** — software transactional memory
- **async** — concurrent operations

## Strict + Lazy

Haskell is **lazy by default** — computations don't run until needed.

- Use `seq`, `BangPatterns`, or `StrictData` extension when you need strictness for performance
- `foldl'` (strict left fold) instead of lazy `foldl` for accumulators
- Profile with `+RTS -p` for time + space costs

## Type Classes

```haskell
class Show a where
    show :: a -> String

class Eq a where
    (==) :: a -> a -> Bool

class (Eq a) => Ord a where      -- Ord depends on Eq
    compare :: a -> a -> Ordering
```

Most types `derive` these automatically:
```haskell
data Color = Red | Green | Blue deriving (Show, Eq, Ord, Enum, Bounded)
```

## Testing

- **HSpec** — RSpec-style BDD tests
- **QuickCheck** — property-based testing (random inputs)

```haskell
import Test.Hspec
import Test.QuickCheck

main :: IO ()
main = hspec $ do
    describe "reverse" $ do
        it "is its own inverse" $ property $
            \xs -> reverse (reverse xs) == (xs :: [Int])
```

## Best Practices

- **Use `Text` not `String`** for production code — `String` is `[Char]`, slow
- **Type signatures on top-level functions** — improves clarity + error messages
- **Avoid partial functions** (`head`, `!!`) — use `Data.Maybe` helpers
- **Strict fields** in records for performance (`!` prefix or `StrictData` extension)
- **`OverloadedStrings`** language extension when using Text/ByteString literals
- **Newtype wrappers** for type safety: `newtype UserId = UserId Int`
- **GHC2021** language edition by default — enables sensible extensions

## Common Pitfalls

- Using `String` (`[Char]`) in hot paths → use `Text`
- Lazy lists holding huge memory unintentionally → use strict folds + bang patterns
- Partial functions like `head []` → runtime crash; use `Data.Maybe`
- Mixing IO and pure code without thinking — keep IO at the edges
- Hidden non-strict evaluation → space leaks; use `seq` / `deepseq`
- Generalized type inference confusing in errors — add explicit signatures

## Resources

- Docs: https://www.haskell.org/documentation
- Book: "Learn You a Haskell" (free online): http://learnyouahaskell.com
- Book: "Haskell Programming from First Principles"
- Hackage (packages): https://hackage.haskell.org
- Stackage (curated LTS): https://www.stackage.org
- Discourse: https://discourse.haskell.org
