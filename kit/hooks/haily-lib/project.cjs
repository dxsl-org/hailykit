#!/usr/bin/env node
/**
 * project.cjs - Project and environment detection logic
 *
 * Extracted from session-init.cjs for reuse in both Claude hooks and OpenCode plugins.
 * Detects project type, package manager, framework, and runtime versions.
 *
 * @module project
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
// SAFE EXECUTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely execute shell command with optional timeout
 * @param {string} cmd - Command to execute
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @returns {string|null} Output or null on error
 */
function execSafe(cmd, timeoutMs = 5000) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (e) {
    return null;
  }
}

/**
 * Safely execute a binary with arguments (no shell interpolation)
 * @param {string} binary - Path to the executable
 * @param {string[]} args - Arguments array
 * @param {number} [timeoutMs=2000] - Timeout in milliseconds
 * @returns {string|null} Output or null on error
 */
function execFileSafe(binary, args, timeoutMs = 2000) {
  try {
    return execFileSync(binary, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PYTHON DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that a path is a file and doesn't contain shell metacharacters
 * @param {string} p - Path to validate
 * @returns {boolean}
 */
function isValidPythonPath(p) {
  if (!p || typeof p !== 'string') return false;
  if (/[;&|`$(){}[\]<>!#*?]/.test(p)) return false;
  try {
    const stat = fs.statSync(p);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}

/**
 * Build platform-specific Python paths for fast filesystem check
 * @returns {string[]} Array of potential Python paths
 */
function getPythonPaths() {
  const paths = [];

  if (process.env.PYTHON_PATH) {
    paths.push(process.env.PYTHON_PATH);
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    if (localAppData) {
      paths.push(path.join(localAppData, 'Microsoft', 'WindowsApps', 'python.exe'));
      paths.push(path.join(localAppData, 'Microsoft', 'WindowsApps', 'python3.exe'));
      for (const ver of ['313', '312', '311', '310', '39']) {
        paths.push(path.join(localAppData, 'Programs', 'Python', `Python${ver}`, 'python.exe'));
      }
    }

    for (const ver of ['313', '312', '311', '310', '39']) {
      paths.push(path.join(programFiles, `Python${ver}`, 'python.exe'));
      paths.push(path.join(programFilesX86, `Python${ver}`, 'python.exe'));
    }

    paths.push('C:\\Python313\\python.exe');
    paths.push('C:\\Python312\\python.exe');
    paths.push('C:\\Python311\\python.exe');
    paths.push('C:\\Python310\\python.exe');
    paths.push('C:\\Python39\\python.exe');
  } else {
    paths.push('/usr/bin/python3');
    paths.push('/usr/local/bin/python3');
    paths.push('/opt/homebrew/bin/python3');
    paths.push('/opt/homebrew/bin/python');
    paths.push('/usr/bin/python');
    paths.push('/usr/local/bin/python');
  }

  return paths;
}

/**
 * Find Python binary using fast `which` lookup first, then filesystem check
 * @returns {string|null} Python binary path or null
 */
function findPythonBinary() {
  // Fast path: try `which` command first (10ms vs 2000ms per path)
  if (process.platform !== 'win32') {
    const whichPython3 = execSafe('which python3', 500);
    if (whichPython3 && isValidPythonPath(whichPython3)) return whichPython3;

    const whichPython = execSafe('which python', 500);
    if (whichPython && isValidPythonPath(whichPython)) return whichPython;
  } else {
    // Windows: try `where` command
    const wherePython = execSafe('where python', 500);
    if (wherePython) {
      const firstPath = wherePython.split('\n')[0].trim();
      if (isValidPythonPath(firstPath)) return firstPath;
    }
  }

  // Fallback: check known paths
  const paths = getPythonPaths();
  for (const p of paths) {
    if (isValidPythonPath(p)) return p;
  }
  return null;
}

/**
 * Get Python version with optimized detection
 * @returns {string|null} Python version string or null
 */
function getPythonVersion() {
  const pythonPath = findPythonBinary();
  if (pythonPath) {
    const result = execFileSafe(pythonPath, ['--version']);
    if (result) return result;
  }

  const commands = ['python3', 'python'];
  for (const cmd of commands) {
    const result = execFileSafe(cmd, ['--version']);
    if (result) return result;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GIT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if current directory is inside a git repository (fast check)
 * Uses filesystem traversal instead of git command to avoid command failures
 * @param {string} [startDir] - Directory to check from (defaults to cwd)
 * @returns {boolean}
 */
function isGitRepo(startDir) {
  let dir;
  try {
    dir = startDir || process.cwd();
  } catch (e) {
    // CWD deleted or inaccessible
    return false;
  }
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.git'))) return true;
    dir = path.dirname(dir);
  }
  return fs.existsSync(path.join(root, '.git'));
}

/**
 * Get git remote URL
 * @returns {string|null}
 */
function getGitRemoteUrl() {
  if (!isGitRepo()) return null;
  return execFileSafe('git', ['config', '--get', 'remote.origin.url']);
}

/**
 * Get current git branch
 * @returns {string|null}
 */
function getGitBranch() {
  if (!isGitRepo()) return null;
  return execFileSafe('git', ['branch', '--show-current']);
}

/**
 * Get git repository root
 * @returns {string|null}
 */
function getGitRoot() {
  if (!isGitRepo()) return null;
  return execFileSafe('git', ['rev-parse', '--show-toplevel']);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect project type based on workspace indicators
 * @param {string} [configOverride] - Manual override from config
 * @returns {'monorepo' | 'library' | 'single-repo'}
 */
function detectProjectType(configOverride) {
  if (configOverride && configOverride !== 'auto') return configOverride;

  if (fs.existsSync('pnpm-workspace.yaml')) return 'monorepo';
  if (fs.existsSync('lerna.json')) return 'monorepo';

  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (pkg.workspaces) return 'monorepo';
      if (pkg.main || pkg.exports) return 'library';
    } catch (e) { /* ignore */ }
  }

  return 'single-repo';
}

/**
 * Detect package manager from lock files
 * @param {string} [configOverride] - Manual override from config
 * @returns {'npm' | 'pnpm' | 'yarn' | 'bun' | null}
 */
function detectPackageManager(configOverride) {
  if (configOverride && configOverride !== 'auto') return configOverride;

  if (fs.existsSync('bun.lockb')) return 'bun';
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('package-lock.json')) return 'npm';

  return null;
}

/**
 * Detect framework from package.json dependencies
 * @param {string} [configOverride] - Manual override from config
 * @returns {string|null}
 */
function detectFramework(configOverride) {
  if (configOverride && configOverride !== 'auto') return configOverride;

  // Gleam/BEAM ecosystem — checked before package.json since Gleam projects have no package.json
  if (fs.existsSync('gleam.toml')) {
    try {
      const gleamToml = fs.readFileSync('gleam.toml', 'utf8');
      if (gleamToml.includes('lustre')) return 'lustre';
    } catch (e) { /* ignore */ }
  }

  // Solidity tooling — primary framework signal for smart contract projects
  if (fs.existsSync('foundry.toml')) return 'foundry';
  if (fs.existsSync('hardhat.config.ts') || fs.existsSync('hardhat.config.js')) return 'hardhat';

  // C# / .NET frameworks — parse *.csproj
  const dotnetFw = detectDotnetFramework();
  if (dotnetFw) return dotnetFw;

  // Ruby frameworks — Gemfile parse
  if (fs.existsSync('Gemfile')) {
    try {
      const gemfile = fs.readFileSync('Gemfile', 'utf8');
      if (/^\s*gem\s+["']rails["']/m.test(gemfile)) return 'rails';
      if (/^\s*gem\s+["']sinatra["']/m.test(gemfile)) return 'sinatra';
    } catch (e) { /* ignore */ }
  }

  // PHP frameworks — composer.json parse
  if (fs.existsSync('composer.json')) {
    try {
      const composer = JSON.parse(fs.readFileSync('composer.json', 'utf8'));
      const reqs = { ...composer.require, ...composer['require-dev'] };
      if (reqs['laravel/framework'] || reqs['laravel/laravel']) return 'laravel';
      if (reqs['symfony/framework-bundle'] || reqs['symfony/symfony']) return 'symfony';
    } catch (e) { /* ignore */ }
  }

  // Java / Kotlin frameworks — pom.xml + build.gradle{,.kts}
  const jvmFw = detectJvmFramework();
  if (jvmFw) return jvmFw;

  // Swift frameworks — Package.swift parse
  if (fs.existsSync('Package.swift')) {
    try {
      const pkg = fs.readFileSync('Package.swift', 'utf8');
      if (/vapor/i.test(pkg)) return 'vapor';
      if (/SwiftUI/.test(pkg)) return 'swiftui';
    } catch (e) { /* ignore */ }
  }

  // Go frameworks — go.mod parse
  if (fs.existsSync('go.mod')) {
    try {
      const gomod = fs.readFileSync('go.mod', 'utf8');
      if (/github\.com\/gin-gonic\/gin/.test(gomod)) return 'gin';
      if (/github\.com\/labstack\/echo/.test(gomod)) return 'echo';
      if (/github\.com\/gofiber\/fiber/.test(gomod)) return 'fiber';
      if (/github\.com\/go-chi\/chi/.test(gomod)) return 'chi';
    } catch (e) { /* ignore */ }
  }

  // Elixir/BEAM frameworks — mix.exs contains deps list
  if (fs.existsSync('mix.exs')) {
    try {
      const mix = fs.readFileSync('mix.exs', 'utf8');
      // Nerves wins over Phoenix when both present (embedded > web)
      if (/:nerves[\s,}]/.test(mix)) return 'nerves';
      if (/:phoenix[\s,}]/.test(mix)) return 'phoenix';
    } catch (e) { /* ignore */ }
  }

  // Rust frameworks — Cargo.toml [dependencies] block
  if (fs.existsSync('Cargo.toml')) {
    const rustFw = detectRustFramework();
    if (rustFw) return rustFw;
  }

  // Shopify — config file signals are stronger than dep-only detection
  if (fs.existsSync('shopify.app.toml') || fs.existsSync('shopify.theme.toml')) return 'shopify';

  // Flutter — pubspec.yaml is primary signal
  if (fs.existsSync('pubspec.yaml')) {
    try {
      const pubspec = fs.readFileSync('pubspec.yaml', 'utf8');
      if (/flutter\s*:/i.test(pubspec)) return 'flutter';
    } catch (e) { /* ignore */ }
  }

  // Python frameworks — check before package.json since pure-Python projects have none
  const pythonFw = detectPythonFramework();
  if (pythonFw) return pythonFw;

  if (!fs.existsSync('package.json')) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Shopify — has its own CLI ecosystem distinct from generic React apps
    if (deps['@shopify/cli'] || deps['@shopify/app']) return 'shopify';
    // Gradio — Python lib but also detectable via package.json in fullstack projects (rare)
    // React Native — checked before plain react
    if (deps['react-native'] || deps['expo']) return 'react-native';
    if (deps['next']) return 'next';
    if (deps['nuxt']) return 'nuxt';
    if (deps['astro']) return 'astro';
    if (deps['@remix-run/node'] || deps['@remix-run/react']) return 'remix';
    if (deps['svelte'] || deps['@sveltejs/kit']) return 'svelte';
    if (deps['vue']) return 'vue';
    if (deps['@tanstack/react-start'] || deps['@tanstack/start']) return 'tanstack-start';
    if (deps['@builder.io/qwik'] || deps['@builder.io/qwik-city']) return 'qwik';
    if (deps['solid-js'] || deps['solid-start']) return 'solidjs';
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['react']) return 'react';
    if (deps['express']) return 'express';
    if (deps['fastify']) return 'fastify';
    if (deps['hono']) return 'hono';
    if (deps['elysia']) return 'elysia';
    if (deps['htmx.org']) return 'htmx';

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Read combined Python dependency text from any of requirements.txt / pyproject.toml / Pipfile.
 * Used by both primary and extras detection.
 * @returns {string|null}
 */
function readPythonDepsText() {
  const parts = [];
  try {
    if (fs.existsSync('requirements.txt')) parts.push(fs.readFileSync('requirements.txt', 'utf8'));
    if (fs.existsSync('pyproject.toml')) parts.push(fs.readFileSync('pyproject.toml', 'utf8'));
    if (fs.existsSync('Pipfile')) parts.push(fs.readFileSync('Pipfile', 'utf8'));
  } catch (e) { /* ignore */ }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Detect Python web framework from requirements.txt or pyproject.toml.
 * Priority: most specific first — litestar > fastapi > starlette > django > flask > streamlit.
 * @returns {string|null}
 */
function detectPythonFramework() {
  const sources = [];
  try {
    if (fs.existsSync('requirements.txt')) {
      sources.push(fs.readFileSync('requirements.txt', 'utf8'));
    }
    if (fs.existsSync('pyproject.toml')) {
      sources.push(fs.readFileSync('pyproject.toml', 'utf8'));
    }
    if (fs.existsSync('Pipfile')) {
      sources.push(fs.readFileSync('Pipfile', 'utf8'));
    }
  } catch (e) { /* ignore */ }

  if (sources.length === 0) return null;
  const combined = sources.join('\n');

  // Match either `^name` (requirements.txt) or `"name"`/`name =` (toml/Pipfile)
  const has = (name) => {
    const re = new RegExp(`(^|[\\n\\s])${name}([\\s=<>~!"'\\]:,]|$)`, 'im');
    return re.test(combined);
  };

  // Order matters — most specific wins
  if (has('litestar')) return 'litestar';
  if (has('fastapi')) return 'fastapi';
  if (has('starlette')) return 'starlette';
  if (has('django')) return 'django';
  if (has('flask')) return 'flask';
  if (has('streamlit')) return 'streamlit';
  if (has('gradio')) return 'gradio';
  return null;
}

/**
 * Detect .NET framework from *.csproj files.
 * Looks for ASP.NET Core, Blazor signals in the project SDK + package references.
 * @returns {'aspnet'|'blazor'|null}
 */
function detectDotnetFramework() {
  try {
    const entries = fs.readdirSync(process.cwd());
    const csprojs = entries.filter(e => e.endsWith('.csproj'));
    if (csprojs.length === 0) return null;

    for (const file of csprojs) {
      const content = fs.readFileSync(file, 'utf8');
      // Blazor — distinct project SDKs
      if (/Sdk="Microsoft\.NET\.Sdk\.BlazorWebAssembly"/.test(content) ||
          /<PackageReference[^>]+Microsoft\.AspNetCore\.Components\.WebAssembly/.test(content)) return 'blazor';
      // ASP.NET Core — generic web SDK
      if (/Sdk="Microsoft\.NET\.Sdk\.Web"/.test(content)) return 'aspnet';
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Detect JVM framework (Spring Boot, Quarkus, Ktor) from pom.xml + build.gradle{,.kts}.
 * @returns {'spring-boot'|'quarkus'|'ktor'|null}
 */
function detectJvmFramework() {
  const sources = [];
  try {
    if (fs.existsSync('pom.xml')) sources.push(fs.readFileSync('pom.xml', 'utf8'));
    if (fs.existsSync('build.gradle')) sources.push(fs.readFileSync('build.gradle', 'utf8'));
    if (fs.existsSync('build.gradle.kts')) sources.push(fs.readFileSync('build.gradle.kts', 'utf8'));
  } catch (e) { /* ignore */ }

  if (sources.length === 0) return null;
  const combined = sources.join('\n');

  if (/spring-boot|org\.springframework\.boot/i.test(combined)) return 'spring-boot';
  if (/quarkus/i.test(combined)) return 'quarkus';
  if (/io\.ktor/i.test(combined)) return 'ktor';
  return null;
}

/**
 * Detect primary Rust framework from Cargo.toml [dependencies].
 * Priority: tauri (desktop) > bevy (game) > leptos/dioxus/yew (frontend) > axum/actix-web/rocket (web server).
 * @returns {string|null}
 */
function detectRustFramework() {
  try {
    const cargo = fs.readFileSync('Cargo.toml', 'utf8');
    // Look for `name = "version"` or `name = { ... }` patterns in [dependencies]/[dev-dependencies]
    const has = (name) => {
      const re = new RegExp(`^\\s*${name}\\s*=`, 'im');
      return re.test(cargo);
    };

    // Desktop/game first — most specific identity
    if (has('tauri')) return 'tauri';
    if (has('bevy')) return 'bevy';
    // Frontend (WASM)
    if (has('leptos')) return 'leptos';
    if (has('dioxus')) return 'dioxus';
    if (has('yew')) return 'yew';
    // Web servers
    if (has('axum')) return 'axum';
    if (has('actix-web') || has('actix_web')) return 'actix-web';
    if (has('rocket')) return 'rocket';
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Detect secondary stack signals: libraries, tooling, sub-frameworks that
 * augment (rather than replace) the primary framework. Each entry maps to a
 * `framework-{name}.md` rule file that the hook auto-injects.
 *
 * Examples: ['better-auth', 'monorepo'] for a Next.js app with Better Auth in a Turborepo.
 *
 * @param {string[]|string} [configOverride] - Manual override from config
 * @returns {string[]}
 */
function detectFrameworkExtras(configOverride) {
  if (Array.isArray(configOverride)) return configOverride;
  if (typeof configOverride === 'string' && configOverride !== 'auto') {
    return configOverride.split(',').map(s => s.trim()).filter(Boolean);
  }

  const extras = [];

  // Monorepo tooling — any of these signals a monorepo
  if (fs.existsSync('turbo.json') ||
      fs.existsSync('nx.json') ||
      fs.existsSync('pnpm-workspace.yaml')) {
    extras.push('monorepo');
  }

  // SePay — config file is most reliable signal (Vietnamese projects often have it
  // alongside any backend stack)
  if (fs.existsSync('sepay.config.js') || fs.existsSync('sepay.config.json')) {
    extras.push('sepay');
  }

  // Elixir/BEAM extras — parse mix.exs deps list
  if (fs.existsSync('mix.exs')) {
    try {
      const mix = fs.readFileSync('mix.exs', 'utf8');
      if (/:phoenix_live_view[\s,}]/.test(mix)) extras.push('liveview');
      if (/:ecto[\s,}]|:ecto_sql[\s,}]/.test(mix)) extras.push('ecto');
      if (/:oban[\s,}]/.test(mix)) extras.push('oban');
      if (/:broadway[\s,}]/.test(mix)) extras.push('broadway');
      if (/:absinthe[\s,}]/.test(mix)) extras.push('absinthe');
    } catch (e) { /* ignore */ }
  }

  // Python extras — langchain, celery, ML libs, data libs (stack on any Python framework)
  const pyDeps = readPythonDepsText();
  if (pyDeps) {
    const hasPy = (name) => new RegExp(`(^|[\\n\\s])${name}([\\s=<>~!"'\\]:,]|$)`, 'im').test(pyDeps);
    if (hasPy('langchain') || hasPy('langgraph')) extras.push('langchain');
    if (hasPy('celery')) extras.push('celery');
    if (hasPy('torch') || hasPy('pytorch')) extras.push('pytorch');
    if (hasPy('pandas')) extras.push('pandas');
    if (hasPy('polars')) extras.push('polars');
    if (hasPy('pydantic')) extras.push('pydantic');
    if (hasPy('sqlalchemy')) extras.push('sqlalchemy');
    if (hasPy('jupyter') || hasPy('ipykernel') || hasPy('jupyterlab')) extras.push('jupyter');
    if (hasPy('transformers')) extras.push('huggingface');
  }

  // Rust extras — ORMs and database libs (stack on axum/actix/rocket primary)
  if (fs.existsSync('Cargo.toml')) {
    try {
      const cargo = fs.readFileSync('Cargo.toml', 'utf8');
      if (/^\s*sqlx\s*=/im.test(cargo)) extras.push('sqlx');
      if (/^\s*diesel\s*=/im.test(cargo)) extras.push('diesel');
      if (/^\s*sea-orm\s*=/im.test(cargo)) extras.push('sea-orm');
    } catch (e) { /* ignore */ }
  }

  // Go extras — sqlc for compile-time SQL → Go codegen
  if (fs.existsSync('sqlc.yaml') || fs.existsSync('sqlc.json')) extras.push('sqlc');

  // package.json libraries that augment a primary framework
  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['better-auth']) extras.push('better-auth');

      // Payment providers — independent libraries, may stack (e.g. Stripe + Polar)
      if (deps['stripe'] || deps['@stripe/stripe-js']) extras.push('stripe');
      if (deps['@polar-sh/sdk'] || deps['@polar-sh/nextjs'] || deps['@polar-sh/better-auth']) extras.push('polar');
      if (deps['@paddle/paddle-node-sdk'] || deps['@paddle/paddle-js']) extras.push('paddle');
      if (deps['creem']) extras.push('creem');
      if (deps['sepay'] && !extras.includes('sepay')) extras.push('sepay');

      // ORMs / data — independent of primary framework, stack with any backend
      if (deps['@prisma/client'] || deps['prisma']) extras.push('prisma');
      if (deps['drizzle-orm']) extras.push('drizzle');
      if (deps['typeorm']) extras.push('typeorm');

      // State management — stacks on React/Vue/Svelte primary
      if (deps['zustand']) extras.push('zustand');

      // UI styling — shadcn/ui (Radix primitives) and Tailwind CSS
      if (deps['@radix-ui/react-slot'] || deps['class-variance-authority'] || deps['@shadcn/ui']) extras.push('shadcn');
      if (deps['tailwindcss'] || deps['@tailwindcss/vite'] || deps['@tailwindcss/postcss']) extras.push('tailwind');
    } catch (e) { /* ignore */ }
  }

  return extras;
}

/**
 * Detect primary programming language from lockfiles in the given directory.
 * Priority: TypeScript > PHP > Go > Rust > Python
 * @param {string} [dir] - Directory to check (defaults to process.cwd())
 * @returns {'typescript'|'php'|'golang'|'rust'|'python'|null}
 */
function detectPrimaryLanguage(dir) {
  const d = dir || process.cwd();

  // Solidity (smart contracts) — checked first since these projects can also have package.json (Hardhat)
  if (fs.existsSync(path.join(d, 'hardhat.config.ts')) ||
      fs.existsSync(path.join(d, 'hardhat.config.js')) ||
      fs.existsSync(path.join(d, 'foundry.toml')) ||
      fs.existsSync(path.join(d, 'truffle-config.js'))) return 'solidity';

  // C# / .NET
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.csproj') || e.endsWith('.sln') || e === 'global.json')) return 'csharp';
  } catch (e) { /* ignore */ }

  // R — DESCRIPTION (CRAN package) or *.Rproj
  if (fs.existsSync(path.join(d, 'DESCRIPTION'))) {
    try {
      const desc = fs.readFileSync(path.join(d, 'DESCRIPTION'), 'utf8');
      if (/^Package:/m.test(desc) || /^Type:\s*Package/m.test(desc)) return 'r';
    } catch (e) { /* ignore */ }
  }
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.Rproj'))) return 'r';
  } catch (e) { /* ignore */ }

  // TypeScript / JavaScript — TS wins if tsconfig.json present, otherwise JS for pure JS projects
  if (fs.existsSync(path.join(d, 'tsconfig.json'))) return 'typescript';
  if (fs.existsSync(path.join(d, 'package.json'))) {
    // Heuristic: if any .ts/.tsx file exists, treat as typescript; otherwise javascript
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['typescript'] || deps['@types/node'] || deps['ts-node']) return 'typescript';
    } catch (e) { /* fall through */ }
    return 'javascript';
  }

  if (fs.existsSync(path.join(d, 'composer.json'))) return 'php';
  if (fs.existsSync(path.join(d, 'go.mod'))) return 'golang';
  if (fs.existsSync(path.join(d, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(d, 'requirements.txt')) ||
      fs.existsSync(path.join(d, 'pyproject.toml'))) return 'python';
  if (fs.existsSync(path.join(d, 'pubspec.yaml'))) return 'dart';
  if (fs.existsSync(path.join(d, 'mix.exs'))) return 'elixir';
  if (fs.existsSync(path.join(d, 'rebar.config')) ||
      fs.existsSync(path.join(d, 'rebar3.config'))) return 'erlang';
  if (fs.existsSync(path.join(d, 'gleam.toml'))) return 'gleam';

  // Ruby — Gemfile or .gemspec
  if (fs.existsSync(path.join(d, 'Gemfile'))) return 'ruby';
  if (fs.existsSync(path.join(d, 'Rakefile'))) return 'ruby';

  // JVM — Kotlin wins over Java if Kotlin build files present, else fall back to Java
  if (fs.existsSync(path.join(d, 'build.gradle.kts')) ||
      fs.existsSync(path.join(d, 'settings.gradle.kts'))) return 'kotlin';
  if (fs.existsSync(path.join(d, 'build.gradle')) ||
      fs.existsSync(path.join(d, 'pom.xml')) ||
      fs.existsSync(path.join(d, 'settings.gradle'))) {
    // Could be either — check for any *.kt file presence
    try {
      const files = fs.readdirSync(path.join(d, 'src'), { recursive: true });
      if (Array.isArray(files) && files.some(f => typeof f === 'string' && f.endsWith('.kt'))) return 'kotlin';
    } catch (e) { /* ignore */ }
    return 'java';
  }

  // Swift — SPM (Package.swift) or Xcode project
  if (fs.existsSync(path.join(d, 'Package.swift'))) return 'swift';
  // Heuristic: any *.xcodeproj or *.xcworkspace directory
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace'))) return 'swift';
  } catch (e) { /* ignore */ }

  // Zig — build.zig is the canonical signal
  if (fs.existsSync(path.join(d, 'build.zig')) ||
      fs.existsSync(path.join(d, 'build.zig.zon'))) return 'zig';

  // Julia — Project.toml + Manifest.toml is canonical Julia signal
  if (fs.existsSync(path.join(d, 'Project.toml')) &&
      fs.existsSync(path.join(d, 'Manifest.toml'))) return 'julia';

  // Haskell — cabal or stack
  if (fs.existsSync(path.join(d, 'stack.yaml')) ||
      fs.existsSync(path.join(d, 'package.yaml'))) return 'haskell';
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.cabal'))) return 'haskell';
  } catch (e) { /* ignore */ }

  // OCaml — dune-project or .opam
  if (fs.existsSync(path.join(d, 'dune-project'))) return 'ocaml';
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.opam'))) return 'ocaml';
  } catch (e) { /* ignore */ }

  // Lua — .luarc.json, init.lua, or *.lua at root
  if (fs.existsSync(path.join(d, '.luarc.json')) ||
      fs.existsSync(path.join(d, 'init.lua')) ||
      fs.existsSync(path.join(d, 'rockspec'))) return 'lua';
  try {
    const entries = fs.readdirSync(d);
    if (entries.some(e => e.endsWith('.lua') || e.endsWith('.rockspec'))) return 'lua';
  } catch (e) { /* ignore */ }

  // Bash/Shell — only as a fallback for repos that are primarily scripts
  try {
    const entries = fs.readdirSync(d);
    const shellFiles = entries.filter(e => /\.(sh|bash|zsh)$/.test(e));
    if (shellFiles.length >= 3) return 'bash';
  } catch (e) { /* ignore */ }

  // C / C++ — CMakeLists or Makefile, heuristic on file extensions
  if (fs.existsSync(path.join(d, 'CMakeLists.txt')) ||
      fs.existsSync(path.join(d, 'Makefile')) ||
      fs.existsSync(path.join(d, 'meson.build'))) {
    // C++ wins if any *.cpp/*.cc/*.cxx/*.hpp present
    try {
      const files = fs.readdirSync(path.join(d, 'src'), { recursive: true });
      if (Array.isArray(files) && files.some(f => typeof f === 'string' && /\.(cpp|cc|cxx|hpp|hh|hxx)$/i.test(f))) return 'cpp';
    } catch (e) { /* ignore — check root dir */ }
    try {
      const entries = fs.readdirSync(d);
      if (entries.some(e => /\.(cpp|cc|cxx|hpp|hh|hxx)$/i.test(e))) return 'cpp';
      if (entries.some(e => /\.(c|h)$/i.test(e))) return 'c';
    } catch (e) { /* ignore */ }
    return 'c';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CODING LEVEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get coding level style name mapping
 * @param {number} level - Coding level (0-5)
 * @returns {string} Style name
 */
function getCodingLevelStyleName(level) {
  const styleMap = {
    0: 'coding-level-0-eli5',
    1: 'coding-level-1-junior',
    2: 'coding-level-2-mid',
    3: 'coding-level-3-senior',
    4: 'coding-level-4-lead',
    5: 'coding-level-5-god'
  };
  return styleMap[level] || 'coding-level-5-god';
}

/**
 * Get coding level guidelines by reading from output-styles .md files
 * @param {number} level - Coding level (-1 to 5)
 * @param {string} [configDir] - Config directory path
 * @returns {string|null} Guidelines text or null if disabled
 */
function getCodingLevelGuidelines(level, configDir) {
  if (level === -1 || level === null || level === undefined) return null;

  const styleName = getCodingLevelStyleName(level);
  // Prefer: explicit arg → HL_CLAUDE_SETTINGS_DIR (set by session-init, points to actual
  // HailyKit install dir whether global or local) → ~/.claude as final fallback.
  // Never default to {project}/.claude — output-styles/ lives in the HailyKit install.
  const basePath = configDir
    || process.env.HL_CLAUDE_SETTINGS_DIR
    || path.join(os.homedir(), '.claude');
  const stylePath = path.join(basePath, 'output-styles', `${styleName}.md`);

  try {
    if (!fs.existsSync(stylePath)) return null;
    const content = fs.readFileSync(stylePath, 'utf8');
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/, '').trim();
    return withoutFrontmatter;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build context summary for output (compact, single line)
 * @param {Object} config - Loaded config
 * @param {Object} detections - Project detections
 * @param {{ path: string|null, resolvedBy: string|null }} resolved - Plan resolution
 * @param {string|null} gitRoot - Git repository root
 * @returns {string}
 */
function buildContextOutput(config, detections, resolved, gitRoot) {
  const lines = [`Project: ${detections.type || 'unknown'}`];
  if (detections.pm) lines.push(`PM: ${detections.pm}`);
  lines.push(`Plan naming: ${config.plan.namingFormat}`);

  if (gitRoot && gitRoot !== process.cwd()) {
    lines.push(`Root: ${gitRoot}`);
  }

  if (resolved.path) {
    if (resolved.resolvedBy === 'session') {
      lines.push(`Plan: ${resolved.path}`);
    } else {
      lines.push(`Suggested: ${resolved.path}`);
    }
  }

  return lines.join(' | ');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect all project information
 *
 * @param {Object} [options]
 * @param {Object} [options.configOverrides] - Override auto-detection
 * @returns {{
 *   type: 'monorepo' | 'library' | 'single-repo',
 *   packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | null,
 *   framework: string | null,
 *   pythonVersion: string | null,
 *   nodeVersion: string,
 *   gitBranch: string | null,
 *   gitRoot: string | null,
 *   gitUrl: string | null,
 *   osPlatform: string,
 *   user: string,
 *   locale: string,
 *   timezone: string
 * }}
 */
function detectProject(options = {}) {
  const { configOverrides = {} } = options;

  return {
    type: detectProjectType(configOverrides.type),
    packageManager: detectPackageManager(configOverrides.packageManager),
    framework: detectFramework(configOverrides.framework),
    frameworkExtras: detectFrameworkExtras(configOverrides.frameworkExtras),
    pythonVersion: getPythonVersion(),
    nodeVersion: process.version,
    gitBranch: getGitBranch(),
    gitRoot: getGitRoot(),
    gitUrl: getGitRemoteUrl(),
    osPlatform: process.platform,
    user: process.env.USERNAME || process.env.USER || process.env.LOGNAME || os.userInfo().username,
    locale: process.env.LANG || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

/**
 * Build static environment info object
 * @param {string} [configDir] - Config directory path
 * @returns {Object} Static environment info
 */
function buildStaticEnv(configDir) {
  return {
    nodeVersion: process.version,
    pythonVersion: getPythonVersion(),
    osPlatform: process.platform,
    gitUrl: getGitRemoteUrl(),
    gitBranch: getGitBranch(),
    gitRoot: getGitRoot(),
    user: process.env.USERNAME || process.env.USER || process.env.LOGNAME || os.userInfo().username,
    locale: process.env.LANG || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    configDir: configDir || process.env.HL_CLAUDE_SETTINGS_DIR || path.join(os.homedir(), '.claude')
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main entry points
  detectProject,
  buildStaticEnv,

  // Detection functions
  detectProjectType,
  detectPackageManager,
  detectFramework,
  detectFrameworkExtras,
  detectPythonFramework,
  detectRustFramework,
  detectDotnetFramework,
  detectJvmFramework,
  detectPrimaryLanguage,

  // Python detection
  getPythonVersion,
  findPythonBinary,
  getPythonPaths,
  isValidPythonPath,

  // Git detection
  isGitRepo,
  getGitRemoteUrl,
  getGitBranch,
  getGitRoot,

  // Coding level
  getCodingLevelStyleName,
  getCodingLevelGuidelines,

  // Output
  buildContextOutput,

  // Helpers
  execSafe,
  execFileSafe
};
