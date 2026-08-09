# Auth Resolution Chain

Use one resolver for CLI and MCP-stdio. MCP HTTP/SSE authenticates at the transport first, then passes per-request auth into the same resolver.

## Precedence — First Hit Wins

1. Explicit flag or transport-provided token. Never log or echo it.
2. Process environment, conventionally `<TOOL>_<KEY>`.
3. Dotenv: `.env.local`, `.env.<NODE_ENV>`, then `.env`; walk only to the package/repository root.
4. User config: XDG/`~/.config/<tool>/config.json` or `%APPDATA%\<tool>\config.json`.
5. Project config: `.<tool>rc.json` or `<tool>.config.json` in the working directory.
6. OS keychain via `keytar`, service `<tool>`, account/profile name.

Document this order. `doctor` reports each value's source without revealing sensitive values.

## Indirection And Profiles

Support `env:NAME`, `keychain:<service>/<account>`, and `file:/absolute/path`. Treat unprefixed strings as literal values. Resolve `--profile` before configuration lookup; explicit/env values still outrank profile values.

Scalar values replace lower-precedence values. Structured configuration merges shallowly, with higher layers replacing keys they define.

## Login Contract

`login [--profile]` prompts interactively, writes the secret to the OS keychain, and updates the active profile. `logout` removes that entry. Never write plaintext credentials to config unless the user explicitly passes `--save-plaintext`; label that option discouraged.

## Redaction

- Mask high-entropy values, key/token fields, and Authorization headers.
- Sensitive `doctor --json` entries expose only `resolved` and `source`; non-sensitive settings may include `value`.
- Never log full request/response bodies or touch the keychain from `postinstall`.
- Never bake secrets into container images.

## Remote Context

For MCP HTTP/SSE, layer 1 is `ctx.auth`, not a CLI flag. Disable keychain lookup in non-local deployments. Preserve the same remaining precedence and redaction rules.
