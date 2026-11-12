#!/usr/bin/env bash
# Desktop: warm a tectonic cache from the official online bundle (needs
# network) and zip it into public/tectonic-cache.zip so the app can compile
# LaTeX offline.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/env.sh"

# Only the desktop toolchain is needed here: CI builds the cache once on Linux
# and ships it to every desktop/Android job. Do not require the Android SDK.
# Desktop (host) build: tectonic uses pkg-config + system dev libs
# (freetype/harfbuzz/fontconfig/graphite2/icu/libpng — all present on SteamOS).
export TECTONIC_DEP_BACKEND=pkg-config
# Debug profile: identical cache output, no LTO tax on the release artifacts.
# (Cache is content-addressed by bundle file hashes; formats depend on the
# engine version, not the build profile.)
(cd "$ROOT/src-tauri" && cargo build --bin prewarm)

WORK="$ROOT/build/prewarm-work"
rm -rf "$WORK"
mkdir -p "$WORK"
"$ROOT/src-tauri/target/debug/prewarm" --out "$WORK"

# goes into the vite frontend (public/ -> dist/ -> embedded app asset)
mkdir -p "$ROOT/public"
rm -f "$ROOT/public/tectonic-cache.zip"
(cd "$WORK/tectonic-cache" && zip -qr "$ROOT/public/tectonic-cache.zip" .)
ls -lh "$ROOT/public/tectonic-cache.zip"
echo "done — rebuild/restart the app so the new cache ships and unpacks"
