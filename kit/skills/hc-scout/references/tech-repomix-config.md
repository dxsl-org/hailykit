# Repomix Configuration Reference

Detailed configuration options for Repomix.

## Configuration File

Create `repomix.config.json` in project root:

```json
{
  "output": {
    "filePath": "repomix-output.xml",
    "style": "xml",
    "removeComments": false,
    "showLineNumbers": true,
    "copyToClipboard": false
  },
  "include": ["**/*"],
  "ignore": {
    "useGitignore": true,
    "useDefaultPatterns": true,
    "customPatterns": ["additional-folder", "**/*.log", "**/tmp/**"]
  },
  "security": {
    "enableSecurityCheck": true
  }
}
```

### Output Options

- `filePath`: Output file path (default: `repomix-output.xml`)
- `style`: Format - `xml`, `markdown`, `json`, `plain` (default: `xml`)
- `removeComments`: Strip comments (default: `false`). Supports HTML, CSS, JS/TS, Vue, Svelte, Python, PHP, Ruby, C, C#, Java, Go, Rust, Swift, Kotlin, Dart, Shell, YAML
- `showLineNumbers`: Include line numbers (default: `true`)
- `copyToClipboard`: Auto-copy output (default: `false`)

### Include/Ignore

- `include`: Glob patterns for files to include (default: `["**/*"]`)
- `useGitignore`: Respect .gitignore (default: `true`)
- `useDefaultPatterns`: Use default ignore patterns (default: `true`)
- `customPatterns`: Additional ignore patterns (same format as .gitignore)

### Security

- `enableSecurityCheck`: Scan for sensitive data with Secretlint (default: `true`)
- Detects: API keys, passwords, credentials, private keys, AWS secrets, DB connections

## Glob Patterns

**Wildcards:**
- `*` - Any chars except `/`
- `**` - Any chars including `/`
- `?` - Single char
- `[abc]` - Char from set
- `{js,ts}` - Either extension

**Examples:**
- `**/*.ts` - All TypeScript
- `src/**` - Specific dir
- `**/*.{js,jsx,ts,tsx}` - Multiple extensions
- `!**/*.test.ts` - Exclude tests

### CLI Options

```bash
repomix --include "src/**/*.ts,*.md"
repomix -i "tests/**,*.test.js"
repomix --no-gitignore
repomix --no-default-patterns
```

### .repomixignore File

Create `.repomixignore` for Repomix-specific patterns (same format as .gitignore):

```
dist/
build/
*.min.js
**/*.test.ts
**/*.spec.ts
coverage/
node_modules/
*.mp4
*.zip
.env*
secrets/
*.key
*.pem
.vscode/
logs/
```

### Pattern Precedence

1. CLI ignore patterns (`-i`)
2. `.repomixignore` file
3. Custom patterns in config
4. `.gitignore` (if enabled)
5. Default patterns (if enabled)

### Pattern Examples

**TypeScript:**
```json
{"include": ["**/*.ts", "**/*.tsx"], "ignore": {"customPatterns": ["**/*.test.ts", "dist/"]}}
```

**React:**
```json
{"include": ["src/**/*.{js,jsx,ts,tsx}", "*.md"], "ignore": {"customPatterns": ["build/"]}}
```

**Monorepo:**
```json
{"include": ["packages/*/src/**"], "ignore": {"customPatterns": ["packages/*/dist/"]}}
```

## Output Formats

| Format | Flag | Best for |
|--------|------|---------|
| XML (default) | `--style xml` | LLMs, structured analysis, programmatic parsing |
| Markdown | `--style markdown` | Documentation, code review, sharing |
| JSON | `--style json` | API integration, custom tooling |
| Plain | `--style plain` | Simple analysis, minimal overhead |

## Advanced Options

```bash
repomix --verbose                     # show processing details
repomix -c /path/to/custom-config.json
repomix --init                        # create repomix.config.json
repomix --no-line-numbers             # smaller output
```

**Performance:** Worker threads handle large codebases in parallel (facebook/react: 123s → 4s with repomix).
