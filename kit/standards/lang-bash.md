# Bash / Shell Scripting Standards

Bash 4+ is the assumed baseline. For maximum portability, target POSIX `sh`. For modern features (associative arrays, `[[ ... ]]`, `mapfile`), Bash 4+ required.

## Shebang + Safety Flags

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

| Flag | Effect |
|---|---|
| `-e` | Exit on first error |
| `-u` | Error on undefined variable |
| `-o pipefail` | Catch errors in piped commands |
| `IFS=$'\n\t'` | Don't word-split on spaces (only newline/tab) |

These four lines prevent 80% of common shell script bugs. **Use them in every script.**

## Variables

```bash
# Naming: lowercase for locals, UPPERCASE for env/constants
local user_id=42
readonly MAX_RETRIES=3

# Always quote: prevents word-splitting + glob expansion
echo "$user_id"          # ✓
echo $user_id            # ✗ — splits on spaces, expands globs

# Default values
echo "${VAR:-default}"   # use default if unset/empty
echo "${VAR:=default}"   # assign if unset (mutates VAR)
echo "${VAR:?error msg}" # exit with error if unset

# String length
echo "${#name}"

# Substring
echo "${name:0:3}"       # first 3 chars
```

## Strings

```bash
# Comparison (use [[ ... ]], not [ ... ])
[[ "$a" == "$b" ]]
[[ "$a" != "$b" ]]
[[ -z "$a" ]]            # empty
[[ -n "$a" ]]            # non-empty
[[ "$a" =~ ^[0-9]+$ ]]   # regex match

# Substitution
${name/old/new}           # replace first
${name//old/new}          # replace all
${name#prefix}            # remove shortest prefix
${name%suffix}            # remove shortest suffix
${name##*/}               # basename
${name%.*}                # strip extension
```

## Arrays

```bash
# Indexed array
fruits=("apple" "banana" "cherry")
echo "${fruits[1]}"        # banana
echo "${fruits[@]}"        # all elements (quoted, individually)
echo "${#fruits[@]}"       # length
fruits+=("date")           # append

# Iterate
for fruit in "${fruits[@]}"; do
    echo "$fruit"
done

# Associative (Bash 4+)
declare -A users
users[alice]=30
users[bob]=25
echo "${users[alice]}"
for key in "${!users[@]}"; do
    echo "$key: ${users[$key]}"
done
```

**Always quote `"${arr[@]}"`** — unquoted causes word-splitting that breaks elements with spaces.

## Functions

```bash
greet() {
    local name="$1"
    local greeting="${2:-Hello}"
    echo "$greeting, $name!"
}

# Return values via stdout (capture with $())
get_user_id() {
    echo "42"
}
user_id=$(get_user_id)

# Or return exit code (0 = success, non-zero = failure)
is_admin() {
    [[ "$1" == "root" ]]
}
if is_admin "$USER"; then
    echo "yes"
fi
```

Bash functions return exit codes, not values. Use stdout + `$()` to "return" data.

## Control Flow

```bash
# if
if [[ -f "$file" ]]; then
    echo "exists"
elif [[ -d "$file" ]]; then
    echo "directory"
else
    echo "neither"
fi

# case
case "$action" in
    start)   start_service ;;
    stop)    stop_service ;;
    restart) stop_service && start_service ;;
    *)       echo "Unknown action: $action"; exit 1 ;;
esac

# Loops
for i in {1..5}; do echo "$i"; done
for f in *.txt; do echo "$f"; done

while read -r line; do
    echo "$line"
done < "$file"

# Numeric comparison: use (( ... ))
if (( count > 10 )); then echo "many"; fi
((count++))
```

## File Tests

```bash
[[ -f file ]]    # regular file exists
[[ -d dir ]]     # directory exists
[[ -e path ]]    # exists (any type)
[[ -r file ]]    # readable
[[ -w file ]]    # writable
[[ -x file ]]    # executable
[[ -s file ]]    # exists + non-empty
[[ file1 -nt file2 ]]  # newer than
```

## Process Substitution + Pipes

```bash
# Read command output line by line
while IFS= read -r line; do
    process "$line"
done < <(grep -r "pattern" .)
# < <( ... ) is process substitution; preserves variables in parent shell

# diff two command outputs
diff <(ls dir1) <(ls dir2)

# Pipe to function
echo "data" | process_input
```

## Error Handling

```bash
# Trap for cleanup
cleanup() {
    rm -f "$tmpfile"
    echo "Done"
}
trap cleanup EXIT

# Custom error handler
on_error() {
    echo "Error on line $1: command exited with $2" >&2
    exit "$2"
}
trap 'on_error $LINENO $?' ERR

# Check command existence
if ! command -v jq &>/dev/null; then
    echo "jq required" >&2
    exit 1
fi
```

## Arguments

```bash
# Positional
echo "Script name: $0"
echo "First arg: $1"
echo "All args: $@"
echo "Arg count: $#"

# Parse flags with getopts
while getopts "hvf:" opt; do
    case $opt in
        h) usage; exit 0 ;;
        v) verbose=1 ;;
        f) file="$OPTARG" ;;
        *) usage; exit 1 ;;
    esac
done
shift $((OPTIND - 1))      # consume parsed flags
```

For complex CLIs, consider `argparse`-style libraries (e.g. `bashly`) or write in Python.

## Best Practices

- **Always use `set -euo pipefail`** + safe `IFS`
- **Quote all variables**: `"$var"`, never `$var`
- Use `[[ ]]` not `[ ]` (Bash) — handles spaces + has regex
- Use `(( ))` for arithmetic, not `expr`
- `$(cmd)` not backticks for command substitution
- Use `mktemp` for temp files: `tmp=$(mktemp)`
- Lint with **shellcheck** in CI — catches everything you'd miss
- Format with **shfmt** — consistent style
- Prefer `printf` over `echo` for portability + flag handling

## Common Pitfalls

- Unquoted variables → word-splitting bugs (`rm $file` when filename has spaces = disaster)
- `cd` without `||` → if cd fails, rest runs in wrong dir; use `cd /path || exit 1`
- Parsing `ls` output — fragile; use globs or `find -print0`
- `read` without `-r` → backslashes get eaten
- Using `#!/bin/sh` then using Bash features → fails on dash/ash
- Mixing tabs + spaces in heredocs without `<<-` → indentation preserved literally

## Testing

**bats** (Bash Automated Testing System):

```bash
#!/usr/bin/env bats

@test "addition works" {
    result="$(./calc.sh add 2 3)"
    [ "$result" = "5" ]
}
```

```bash
bats test/
```

## When to Use Bash vs Something Else

| Use Bash for | Use Python/Go for |
|---|---|
| <100 lines, glue scripts | >100 lines, complex logic |
| Calling other CLI tools | Data structures, math |
| One-shot deploy / setup | Long-running services |
| `~/.bashrc` / dotfiles | Anything testable |

Past ~200 lines, Bash becomes painful. Rewrite in Python / Go / Deno.

## Resources

- Bash manual: https://www.gnu.org/software/bash/manual
- ShellCheck: https://www.shellcheck.net
- Bash Pitfalls: https://mywiki.wooledge.org/BashPitfalls
- Bash Strict Mode: http://redsymbol.net/articles/unofficial-bash-strict-mode
- Google Shell Style Guide: https://google.github.io/styleguide/shellguide.html
