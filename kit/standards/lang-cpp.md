# C++ Standards (C++17/20+)

## Comments

### Doxygen (public API)
```cpp
/**
 * Why this function exists + non-obvious contract.
 *
 * @param user_id Must be a valid UUID; behavior undefined if malformed
 * @return Owning pointer to user, or nullptr when soft-deleted
 * @throws NotFoundException when user_id doesn't exist
 *
 * @note Caller owns the returned pointer — prefer get_user_unique() for RAII.
 */
[[nodiscard]] std::unique_ptr<User> get_user(std::string_view user_id);
```

- Doxygen on public headers; minimal comments in `.cpp` implementation
- `[[nodiscard]]` on any function whose return value must be checked (error codes, allocations, handles)
- Document ownership transfer explicitly — raw pointers, `unique_ptr`, `shared_ptr` carry different contracts

### Lifetime & Ownership (MANDATORY for raw pointers)
Document who owns, who borrows, and how long the borrow is valid:
```cpp
// Returned pointer is non-owning; valid until the next call to refresh().
const Config* current_config() const noexcept;

// Caller takes ownership — must delete or transfer.
[[nodiscard]] Buffer* allocate_buffer(size_t bytes);
```

### Unsafe & undefined behavior
```cpp
// SAFETY: ptr is non-null and aligned — invariant established by parse_header() above
auto val = *reinterpret_cast<const int32_t*>(ptr);
```
Any `reinterpret_cast`, `const_cast`, raw `memcpy` over typed memory, or manual lifetime extension requires a `// SAFETY:` line explaining the invariant.

## Key Idioms

### RAII Over Manual Management
```cpp
// Never new/delete directly — use smart pointers or stack allocation
auto user = std::make_unique<User>(id, name);          // owning
auto cache = std::make_shared<Cache>();                // shared ownership
std::vector<int> buf(1024);                            // stack-managed container

// Custom resource? Wrap it.
struct FileHandle {
    FILE* f;
    ~FileHandle() noexcept { if (f) fclose(f); }
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
};
```

### const-correctness
```cpp
// const by default — only drop const when mutation is required
int compute(const std::vector<int>& data) const noexcept;

// constexpr for compile-time evaluation
constexpr int max_users = 1024;
```

### Modern Error Handling
```cpp
// std::expected (C++23) or std::variant for recoverable errors
std::expected<User, ErrorCode> find_user(std::string_view id);

// Exceptions for unexpected/programmer errors only
// Never throw across ABI boundaries (extern "C", DLL interfaces)

// noexcept where it cannot throw — enables move optimizations
Buffer::Buffer(Buffer&& other) noexcept;
```

### Move Semantics
```cpp
// Rule of Zero: prefer types where compiler-generated specials are correct
// Rule of Five: if you define one of {dtor, copy, copy=, move, move=}, define all five

class Resource {
    Resource(Resource&&) noexcept = default;
    Resource& operator=(Resource&&) noexcept = default;
    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;
};

// std::move signals intent — does not actually move
void consume(Buffer&& b);
auto x = std::move(local_buf);  // local_buf is now valid but unspecified
```

### Templates & Concepts (C++20)
```cpp
// Constrain templates with concepts — clearer errors, better intent
template <std::integral T>
T abs_value(T x) noexcept { return x < 0 ? -x : x; }

// Hide template implementation in headers behind concept-checked APIs
```

### Avoid
- Raw `new`/`delete` outside RAII wrappers
- C-style casts: `(int)x` — use `static_cast<int>(x)`
- `using namespace std;` in headers
- Macros for constants (use `constexpr`) or for functions (use `inline`/templates)
- Returning references to locals or to container elements that may reallocate

## Naming
- Types/Classes/Concepts: `PascalCase` or `snake_case` (pick one per project; STL uses `snake_case`)
- Functions/variables/parameters: `snake_case` (STL convention) — match existing codebase if different
- Constants/macros: `SCREAMING_SNAKE_CASE`
- Member variables: trailing `_` (`buffer_`, `size_`) — distinguishes from locals
- Template parameters: `PascalCase` single word (`T`, `Iter`, `Container`)
- Header guards: `PROJECT_PATH_FILE_HPP` or `#pragma once` (prefer the latter)

## Build & Headers
- `.hpp` for C++ headers, `.h` only for C-compatible headers
- Include what you use — every type/function used should be `#include`d directly
- Forward declare in headers when only pointers/references are used
- `#pragma once` over include guards (universally supported)
