#!/usr/bin/env sh
# hailykit installer — no npm or account required.
#
# Bootstraps the compiled hailykit CLI onto this machine, then (best-effort)
# installs the skill catalog for the chosen provider via the CLI.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dxsl-org/hailykit/main/install.sh | sh
#   curl -fsSL ... | sh -s -- --provider cursor
#   sh install.sh --version v0.1.0
#
# Options:
#   --version <tag>    Install a specific release (default: latest)
#   --provider <name>  claude|gemini|cursor|windsurf|opencode|codex|antigravity|zed|all (default: claude)
#   --project          Install the catalog into the current project instead of globally
#   --no-venv          Skip Python venv setup
#   --no-catalog       Bootstrap the CLI only; do not install any skill catalog

set -e

GITHUB_API="https://api.github.com"
GITHUB_BASE="https://github.com"
REPO="dxsl-org/hailykit"
HAILYKIT_HOME="${HAILYKIT_HOME:-$HOME/.hailykit}"
BIN_DIR="${HAILYKIT_BIN:-$HOME/.local/bin}"

VERSION=""
PROVIDER="claude"
PROJECT=""
NO_VENV=""
NO_CATALOG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --version)    VERSION="$2"; shift 2 ;;
    --provider)   PROVIDER="$2"; shift 2 ;;
    --project)    PROJECT="--project"; shift ;;
    --no-venv)    NO_VENV="--no-venv"; shift ;;
    --no-catalog) NO_CATALOG="1"; shift ;;
    *)            shift ;;
  esac
done

die() { echo "✗ $1" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

need_cmd curl
command -v unzip >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 \
  || die "unzip or python3 is required to extract the release"
command -v node >/dev/null 2>&1 || die "Node.js >=20 is required. Install from https://nodejs.org"

# ── Fetch release metadata ──────────────────────────────────────────────────
TAG="${VERSION:-latest}"
echo "Fetching hailykit release (${TAG})..."
if [ "$TAG" = "latest" ]; then
  RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "${GITHUB_API}/repos/${REPO}/releases/latest")
else
  RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "${GITHUB_API}/repos/${REPO}/releases/tags/${TAG}")
fi

TAG_NAME=$(printf '%s' "$RELEASE_JSON" | grep '"tag_name"' | head -1 \
  | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
DOWNLOAD_URL=$(printf '%s' "$RELEASE_JSON" | grep '"browser_download_url"' | grep 'hailykit\.zip' \
  | head -1 | sed 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

[ -n "$TAG_NAME" ] || die "Could not parse tag name from release API response"
[ -n "$DOWNLOAD_URL" ] || DOWNLOAD_URL="${GITHUB_BASE}/${REPO}/archive/refs/tags/${TAG_NAME}.zip"

# ── Download & extract ──────────────────────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "  Downloading ${TAG_NAME}..."
curl -fsSL "$DOWNLOAD_URL" -o "$TMP/hailykit.zip"

echo "  Extracting..."
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$TMP/hailykit.zip" -d "$TMP/extracted"
else
  python3 -m zipfile -e "$TMP/hailykit.zip" "$TMP/extracted"
fi

# Locate the dir that actually contains dist/ (archives may nest one level).
EXTRACTED="$TMP/extracted"
if [ ! -d "$EXTRACTED/dist" ]; then
  INNER=$(find "$EXTRACTED" -maxdepth 2 -type d -name dist | head -1)
  [ -n "$INNER" ] || die "Release archive does not contain a built dist/ directory"
  EXTRACTED=$(dirname "$INNER")
fi
[ -f "$EXTRACTED/dist/bin.js" ] || die "Release archive is missing dist/bin.js"

# ── Install the CLI ─────────────────────────────────────────────────────────
echo "  Installing CLI to ${HAILYKIT_HOME}..."
mkdir -p "$HAILYKIT_HOME"
rm -rf "$HAILYKIT_HOME/dist"
cp -r "$EXTRACTED/dist" "$HAILYKIT_HOME/"
[ -f "$EXTRACTED/package.json" ] && cp "$EXTRACTED/package.json" "$HAILYKIT_HOME/"

mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/hailykit" << WRAPPER
#!/usr/bin/env sh
exec node "${HAILYKIT_HOME}/dist/bin.js" "\$@"
WRAPPER
chmod +x "$BIN_DIR/hailykit"

# ── Install the skill catalog via the CLI (best-effort) ─────────────────────
if [ -z "$NO_CATALOG" ]; then
  echo ""
  echo "  Installing skill catalog (provider: ${PROVIDER})..."
  # Do not abort the whole bootstrap if no catalog release exists yet.
  node "$HAILYKIT_HOME/dist/bin.js" install \
    --provider "$PROVIDER" \
    --version "$TAG_NAME" \
    ${PROJECT:+$PROJECT} \
    ${NO_VENV:+$NO_VENV} || echo "  (catalog install skipped — run 'hailykit install' once a catalog release is available)"
fi

echo ""
echo "✓ hailykit ${TAG_NAME} installed"

# Warn if BIN_DIR is not on PATH.
case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    echo ""
    echo "  Add ${BIN_DIR} to your PATH to use the hailykit command:"
    echo "    export PATH=\"\$PATH:${BIN_DIR}\""
    echo "  Add that line to ~/.bashrc or ~/.zshrc to make it permanent."
    ;;
esac
