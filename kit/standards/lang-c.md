# C Standards (C11/C17)

## Comments

### Function Headers (public API in headers)
```c
/**
 * Look up a user by id.
 *
 * @param store     non-null, initialized user store
 * @param user_id   null-terminated UUID string
 * @param out_user  non-null; on success, set to a borrowed pointer (owned by store)
 *
 * @return  0 on success, -ENOENT when user_id is unknown, -EINVAL on bad input.
 * @note    *out_user is valid until the next call that mutates store.
 */
int user_store_get(const user_store_t *store, const char *user_id, const user_t **out_user);
```

- Document EVERY pointer parameter: ownership, nullability, lifetime, and aliasing constraints
- Document return-code convention per project (0 = ok, negative errno, etc.) — be consistent
- Headers carry the contract; `.c` files carry implementation notes only

### Lifetime, Ownership, Aliasing (MANDATORY)
C has no ownership model — comments are the only contract.
```c
// Caller owns the returned buffer — must free() it.
char *strdup_lower(const char *s);

// Returned pointer is borrowed from `arena`; valid until arena_reset().
const char *arena_intern(arena_t *arena, const char *s);

// `dst` and `src` must not overlap.
void copy_n(void *restrict dst, const void *restrict src, size_t n);
```

### Unsafe Casts & Aliasing
```c
/* SAFETY: hdr is 4-byte aligned (checked by caller) and the buffer is at least
 *         sizeof(uint32_t) bytes long (validated against header.length). */
uint32_t magic = *(const uint32_t *)hdr;
```
Any cast that violates strict aliasing, any deliberate undefined behavior, any `memcpy` between incompatible types — must have a `/* SAFETY: */` comment.

## Key Idioms

### Error Handling — Return Codes
```c
// Return int (errno-style) or a project-specific result_t; out-params for values
int parse_config(const char *path, config_t *out) {
    FILE *f = fopen(path, "r");
    if (!f) return -errno;

    int rc = read_into(f, out);
    fclose(f);
    return rc;
}

// goto cleanup pattern — the idiomatic way to handle multi-step resource cleanup
int load(const char *path, data_t *out) {
    int rc = 0;
    FILE *f = NULL;
    char *buf = NULL;

    f = fopen(path, "r");
    if (!f) { rc = -errno; goto done; }

    buf = malloc(SIZE);
    if (!buf) { rc = -ENOMEM; goto done; }

    rc = parse(buf, out);

done:
    free(buf);
    if (f) fclose(f);
    return rc;
}
```

### Memory & Lifetime
```c
// Always pair malloc/free in the same scope or document the handoff explicitly
// calloc when you need zeroed memory; realloc into a tmp variable (it can fail)
char *tmp = realloc(buf, new_size);
if (!tmp) { free(buf); return -ENOMEM; }
buf = tmp;

// Initialize all locals — uninitialized reads are undefined behavior
struct config cfg = {0};

// Use static analysis (clang -Wall -Wextra -Werror, scan-build, Valgrind, ASan)
```

### Integer & Buffer Safety
```c
// Use size_t for sizes and indices, never int
size_t len = strlen(name);

// Check for overflow before allocating
if (count > SIZE_MAX / sizeof(item_t)) return -EOVERFLOW;
items = malloc(count * sizeof(item_t));

// Always use bounded string functions
snprintf(dst, sizeof dst, "%s/%s", dir, file);   // good
strcpy(dst, src);                                // never — use strlcpy or snprintf
```

### Macros
```c
// All-caps for macros; wrap multi-line in do { } while (0)
#define LOG_ERR(fmt, ...) do { fprintf(stderr, fmt "\n", ##__VA_ARGS__); } while (0)

// Always parenthesize macro args
#define MAX(a, b) ((a) > (b) ? (a) : (b))

// Prefer inline functions or enums over function-like macros / #define constants
static inline int max(int a, int b) { return a > b ? a : b; }
enum { MAX_USERS = 1024 };
```

### Headers
```c
// Include guards or #pragma once (consistent per project)
#ifndef PROJECT_MODULE_FILE_H
#define PROJECT_MODULE_FILE_H

// Forward declare in headers when possible — speeds up compilation
struct user;
int user_get(const struct user *u, const char **out_name);

#endif /* PROJECT_MODULE_FILE_H */
```

## Naming
- Types: `snake_case_t` suffix (`user_t`, `config_t`) — common but optional per project
- Functions: `snake_case`, prefixed with module name (`user_get`, `config_load`)
- Constants/macros: `SCREAMING_SNAKE_CASE`
- Static (file-local) symbols: same case as public, but never exported
- Header guards: `PROJECT_PATH_FILE_H`

## Layout
- One module per `.h` + `.c` pair, named identically (`user_store.h` + `user_store.c`)
- `static` for any function/variable not exported — minimize the public surface
- Compile with `-Wall -Wextra -Wpedantic -Werror` and run under ASan/UBSan in CI
