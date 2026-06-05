# Lua Standards

Lua 5.1+ / LuaJIT — used in Neovim, Redis scripting, game scripting (Roblox, LÖVE, Defold), embedded systems, OpenResty.

## Core Idioms

### Variables

- `local` by default — globals are an anti-pattern
- One declaration per line for clarity
- `local x, y = 1, 2` for parallel assignment

```lua
local count = 0
local name = "Alice"
local x, y = 10, 20
```

### Tables (THE Data Structure)

Lua has one composite type: **tables**. Used as arrays, dictionaries, structs, objects, modules.

```lua
local list = { 1, 2, 3 }                   -- array-style (1-indexed!)
local user = { name = "Alice", age = 30 }   -- map-style
local mixed = { 1, 2, name = "Alice" }      -- both

-- Access
list[1]              -- 1 (NOT 0-indexed)
user.name            -- "Alice"
user["name"]         -- same as .name
```

**Lua is 1-indexed.** This catches everyone migrating from other languages.

### Functions

```lua
local function add(a, b)
    return a + b
end

-- Multiple returns
local function divmod(a, b)
    return a // b, a % b
end
local q, r = divmod(10, 3)

-- Variadic
local function log(level, fmt, ...)
    print(level, string.format(fmt, ...))
end
```

Functions are first-class — pass them around like values.

### Control Flow

```lua
-- if/elseif/else
if x > 0 then
    return "positive"
elseif x < 0 then
    return "negative"
else
    return "zero"
end

-- while
while not done do
    -- ...
end

-- numeric for
for i = 1, 10 do print(i) end       -- 1 to 10 inclusive
for i = 1, 10, 2 do print(i) end    -- step 2

-- generic for (iterators)
for k, v in pairs(user) do print(k, v) end       -- map
for i, v in ipairs(list) do print(i, v) end      -- array (in order)
```

`pairs` iterates everything; `ipairs` only the array portion (stops at first nil).

### Truthiness

Only `false` and `nil` are falsy. Everything else (including `0`, `""`, empty tables) is truthy. Mind this when porting from other languages.

```lua
if 0 then print("yes") end          -- prints "yes"
if "" then print("yes") end         -- prints "yes"
```

### Strings

```lua
local s = "hello"
local t = 'world'           -- single quotes also OK
local long = [[
multi-line
string here
]]

#s                          -- 5 (length)
s .. " " .. t               -- concatenation: "hello world"
string.format("%d + %d = %d", 1, 2, 3)
string.upper(s), string.lower(s), string.sub(s, 2, 4)
```

### Modules

```lua
-- mymodule.lua
local M = {}

function M.greet(name)
    return "Hello, " .. name
end

return M

-- caller.lua
local mymodule = require("mymodule")
print(mymodule.greet("World"))
```

`require` searches `package.path`. In Neovim, modules under `lua/` are auto-included.

### Object-Oriented (via Metatables)

```lua
local Counter = {}
Counter.__index = Counter

function Counter.new(initial)
    return setmetatable({ count = initial or 0 }, Counter)
end

function Counter:increment()        -- colon = implicit self
    self.count = self.count + 1
end

function Counter:get()
    return self.count
end

local c = Counter.new(5)
c:increment()           -- equivalent to Counter.increment(c)
print(c:get())          -- 6
```

`:` syntax sugar implicitly passes `self` as first arg.

## Common Standard Libs

- `string` — string manipulation + Lua patterns (NOT regex)
- `table` — `table.insert`, `table.remove`, `table.concat`, `table.sort`
- `math` — `math.floor`, `math.random`, `math.pi`, `math.huge`
- `io` — file I/O (`io.open`, `io.lines`)
- `os` — `os.time`, `os.date`, `os.getenv`
- `coroutine` — cooperative multitasking primitives

## Lua Patterns (Not Regex)

Lua's pattern matching is similar to regex but with different syntax:

```lua
string.match("hello 123 world", "(%d+)")     -- "123"
string.gmatch("a,b,c", "[^,]+")               -- iterator over "a", "b", "c"
string.gsub("foo bar", "(%w+)", "%1!")        -- "foo! bar!"
```

Patterns use `%` instead of `\` for escapes, no alternation `|`, no `+?` lazy quantifiers. For real regex, use `lpeg` or `lrexlib`.

## Performance (LuaJIT)

- LuaJIT is often 10-100x faster than reference Lua
- Avoid creating tables in hot loops — reuse
- Use `local` for hot variables — local access is faster than global
- `table.insert(t, x)` is slower than `t[#t+1] = x` for hot loops

## Neovim-Specific

In Neovim config (`init.lua` or `lua/config/`):

```lua
-- Set options
vim.opt.number = true
vim.opt.relativenumber = true
vim.g.mapleader = " "

-- Keymaps
vim.keymap.set('n', '<leader>w', ':write<CR>', { desc = "Save" })

-- Autocmds
vim.api.nvim_create_autocmd('BufWritePre', {
    pattern = '*.lua',
    callback = function() vim.lsp.buf.format() end,
})

-- Plugins (with lazy.nvim)
require('lazy').setup({
    { 'neovim/nvim-lspconfig' },
    { 'nvim-treesitter/nvim-treesitter', build = ':TSUpdate' },
})
```

## Best Practices

- **`local` everywhere** — globals cause subtle bugs + slow access
- Use `assert()` for invariants — gives clear error messages
- Return errors as `nil, "error message"` — caller checks with `if not result then`
- Modules return a table — never expose raw values via `_G`
- Use `pairs` only when iteration order doesn't matter; `ipairs` for arrays
- Comment headers for module purpose; LDoc-style docstrings for functions

## Common Pitfalls

- Forgetting Lua is **1-indexed** — off-by-one bugs vs other languages
- Treating `0` or `""` as falsy → they're truthy in Lua
- Using `pairs` when you need order → it doesn't guarantee iteration order
- Concatenating in tight loops → use `table.concat({...}, "")` instead
- Globals from missing `local` → bugs that work locally but break under strict mode
- `#t` on tables with holes (`nil` in the middle) → undefined behavior

## Resources

- Lua 5.4 ref: https://www.lua.org/manual/5.4
- Programming in Lua (book): https://www.lua.org/pil
- LuaJIT: https://luajit.org
- Neovim Lua guide: `:help lua-guide`
- Roblox Lua: https://create.roblox.com/docs/luau (Luau = Roblox's typed Lua dialect)
