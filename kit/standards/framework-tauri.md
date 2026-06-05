# Tauri Standards

Detected via `tauri` in `Cargo.toml` `[dependencies]`.

## What Tauri Is

Tauri builds **native desktop + mobile apps** with a Rust backend + web frontend (React/Vue/Svelte/Solid/vanilla JS). Alternative to Electron — drastically smaller bundles (~3-10MB vs ~100MB+), uses OS-native webview, lower memory.

## When to Use

- Cross-platform desktop apps (Windows, macOS, Linux)
- Want native-feeling apps with web frontend
- Bundle size + memory matter (mobile, low-end machines)
- Need to access OS APIs from Rust (filesystem, network, process spawning)
- Tauri 2 (current) also targets iOS + Android

## Setup

```bash
npm create tauri-app@latest
# Pick: React, Vue, Svelte, Solid, etc.
```

Manual:
```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Project Layout

```
my-app/
├── src/                    # Frontend (React/Vue/etc.)
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json     # App config
│   └── src/
│       ├── main.rs
│       └── lib.rs
├── package.json            # Frontend deps
└── index.html
```

## Commands (Rust ↔ Frontend Bridge)

```rust
// src-tauri/src/lib.rs
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
async fn fetch_data(state: tauri::State<'_, AppState>, id: u64) -> Result<User, String> {
    state.repo.find(id).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { /* ... */ })
        .invoke_handler(tauri::generate_handler![greet, fetch_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```ts
// Frontend
import { invoke } from '@tauri-apps/api/core';

const message = await invoke<string>('greet', { name: 'World' });
const user = await invoke<User>('fetch_data', { id: 123 });
```

**Always validate inputs** in commands — they come from JS, treat as untrusted.

## Events (Pub/Sub)

```rust
// Rust → Frontend
use tauri::Emitter;

#[tauri::command]
fn start_progress(window: tauri::Window) {
    std::thread::spawn(move || {
        for i in 0..=100 {
            window.emit("progress", i).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });
}
```

```ts
// Frontend
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<number>('progress', (event) => {
    console.log('Progress:', event.payload);
});
// later: unlisten()
```

Use events for streaming / progress / async notifications. Commands for request/response.

## Capabilities (Security)

Tauri 2 uses **capabilities** — JSON files declaring which Rust APIs the frontend can call:

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$APPDATA/**" }] },
    "dialog:default",
    "notification:default",
    "shell:allow-open"
  ]
}
```

**Default-deny** — frontend can't call any plugin/system API without explicit permission. Scope filesystem access tightly.

## Plugins

Official plugins for common needs:

| Plugin | Purpose |
|---|---|
| `tauri-plugin-fs` | Filesystem access |
| `tauri-plugin-dialog` | Native file/save dialogs |
| `tauri-plugin-notification` | Desktop notifications |
| `tauri-plugin-shell` | Shell command execution |
| `tauri-plugin-clipboard-manager` | Clipboard |
| `tauri-plugin-store` | Persistent key-value store |
| `tauri-plugin-sql` | SQLite/MySQL/Postgres |
| `tauri-plugin-http` | HTTP client (use this, not browser fetch, for cross-origin) |
| `tauri-plugin-updater` | Auto-update (delta updates) |
| `tauri-plugin-window-state` | Persist window size/position |
| `tauri-plugin-deep-link` | Custom URL scheme handlers |

```toml
# Cargo.toml
[dependencies]
tauri-plugin-fs = "2"
```

```rust
.plugin(tauri_plugin_fs::init())
```

```ts
import { readTextFile } from '@tauri-apps/plugin-fs';
const content = await readTextFile('config.json');
```

## State

```rust
struct AppState {
    db: tokio::sync::Mutex<Db>,
}

#[tauri::command]
async fn save(state: tauri::State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let mut db = state.db.lock().await;
    db.set(&key, &value).map_err(|e| e.to_string())
}
```

State must be `Send + Sync + 'static`. Wrap mutable state in `Mutex` / `RwLock` (use `tokio::sync` for async-aware locks).

## Configuration

`src-tauri/tauri.conf.json`:
```json
{
  "productName": "MyApp",
  "version": "1.0.0",
  "identifier": "com.example.myapp",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{ "title": "MyApp", "width": 1024, "height": 768 }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"]
  }
}
```

## Auto-Updates

```toml
[dependencies]
tauri-plugin-updater = "2"
```

Set up updater endpoint serving JSON with latest version + signed binary URLs. Plugin handles download + delta + verify + apply.

## Mobile (Tauri 2)

```bash
npm run tauri ios init       # iOS project
npm run tauri android init   # Android project
npm run tauri ios dev
npm run tauri android dev
```

iOS requires Xcode + Apple Developer account for device deployment. Android requires Android Studio + SDK. Same Rust code; some plugins are mobile-only or desktop-only.

## Best Practices

- **Validate all inputs** in `#[tauri::command]` — they come from JS, treat as untrusted
- Use **capabilities** to lock down which APIs frontend can call — default-deny
- Async commands for I/O work — sync commands block the runtime
- Use `tokio::sync::Mutex` for shared mutable state (not `std::sync::Mutex` in async)
- Emit events for streaming work (progress bars, log tails) — better UX than polling
- Bundle frontend assets via Tauri's build pipeline — `frontendDist` points to your build output
- Code-sign releases (macOS Developer ID, Windows EV cert) — users see scary warnings otherwise

## Common Pitfalls

- Calling sync blocking code (`std::fs::read`) in async command → blocks executor; use async file APIs
- Missing permission in capability file → silent failure or cryptic "not allowed" error
- Storing `&str` in state → lifetime hell; use `String` and clone
- Forgetting `tauri::generate_handler![...]` for new commands → "command not found" at runtime
- Mixing browser fetch with custom URL schemes → CORS issues; use `tauri-plugin-http`
- Heavy native deps in Cargo.toml → slow `cargo build`, large binaries

## Resources

- Docs: https://tauri.app
- Plugins: https://tauri.app/plugin
- v2 Guide: https://tauri.app/start
- Awesome Tauri: https://github.com/tauri-apps/awesome-tauri
