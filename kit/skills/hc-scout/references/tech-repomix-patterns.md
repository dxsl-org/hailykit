# Repomix Usage Patterns

Practical workflows for using Repomix (`hc:scout --pack`) in different scenarios.

## AI Analysis Workflows

### Full Repository
```bash
repomix --remove-comments --style markdown -o full-repo.md
```
**Use:** New codebase, architecture review, complete LLM context, planning.

### Focused Module
```bash
repomix --include "src/auth/**,src/api/**" -o modules.xml
```
**Use:** Feature analysis, debugging specific areas, targeted refactoring.

### Incremental Analysis
```bash
git checkout feature-branch && repomix --include "src/**" -o feature.xml
git checkout main && repomix --include "src/**" -o main.xml
```
**Use:** Feature branch review, change impact, before/after comparison.

### Cross-Repository
```bash
npx repomix --remote org/repo1 -o repo1.xml
npx repomix --remote org/repo2 -o repo2.xml
```
**Use:** Microservices, library comparisons, consistency checks.

## Security Audit

### Third-Party Library
```bash
npx repomix --remote vendor/library --style xml -o audit.xml
```
Check for: API keys, hardcoded credentials, network calls, obfuscation, malicious patterns.

### Pre-Deployment
```bash
repomix --include "src/**,config/**" --style xml -o pre-deploy-audit.xml
```

### Dependency Audit
```bash
repomix --include "**/package.json,**/package-lock.json" -o deps.md --style markdown
repomix --include "node_modules/suspicious-package/**" -o dep-audit.xml
```

## Documentation

### API Documentation
```bash
repomix --include "src/api/**,src/routes/**,src/controllers/**" --remove-comments -o api-context.xml
```
Workflow: Package → AI → OpenAPI/Swagger → endpoint docs → examples.

### Architecture
```bash
repomix --include "src/**/*.ts,*.md" -i "**/*.test.ts" --style markdown -o architecture.md
```

## Library Evaluation

### Quick Assessment
```bash
npx repomix --remote owner/library --style markdown -o library-eval.md
```

### Feature Comparison
```bash
npx repomix --remote owner/lib-a --style xml -o lib-a.xml
npx repomix --remote owner/lib-b --style xml -o lib-b.xml
```

### Migration Planning
```bash
repomix --include "node_modules/old-lib/**" -o old-lib.xml
npx repomix --remote owner/new-lib -o new-lib.xml
```

## Workflow Integration

### CI/CD (GitHub Actions)
```yaml
- name: Generate Snapshot
  run: |
    npm install -g repomix
    repomix --style markdown -o release-snapshot.md
- name: Upload Artifact
  uses: actions/upload-artifact@v3
  with: {name: repo-snapshot, path: release-snapshot.md}
```

## Language-Specific Patterns

| Language | Command |
|----------|---------|
| TypeScript | `repomix --include "**/*.ts,**/*.tsx" --remove-comments --no-line-numbers` |
| React | `repomix --include "src/**/*.{js,jsx,ts,tsx},public/**" -i "build/,*.test.*"` |
| Node.js | `repomix --include "src/**/*.js,config/**" -i "node_modules/,logs/,tmp/"` |
| Python | `repomix --include "**/*.py,requirements.txt,*.md" -i "**/__pycache__/,venv/"` |
| Monorepo | `repomix --include "packages/*/src/**" -i "packages/*/node_modules/,packages/*/dist/"` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Output too large | `repomix -i "node_modules/**,dist/**,coverage/**" --include "src/core/**" --remove-comments --no-line-numbers` |
| Missing files | `repomix --no-gitignore --no-default-patterns --verbose` then check `.gitignore` / `.repomixignore` |
| Sensitive data warnings | Review files → add to `.repomixignore` → use env vars; `--no-security-check` for confirmed false positives |
| Remote access fail | Use full URL: `npx repomix --remote https://github.com/owner/repo` |
