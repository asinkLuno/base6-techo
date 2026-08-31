#!/usr/bin/env bash
set -euo pipefail

[[ $(uname -s) == Darwin && $(uname -m) == arm64 ]] || {
  echo "package-all-macos.sh requires an Apple Silicon Mac" >&2
  exit 1
}

for command in brew cargo corepack curl docker rustup unzip; do
  command -v "$command" >/dev/null || {
    echo "missing command: $command" >&2
    exit 1
  }
done
docker info >/dev/null || {
  echo "Docker is not running" >&2
  exit 1
}

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"
platform=${1:-all}
[[ $platform == all || $platform == macos || $platform == windows || $platform == linux ]] || {
  echo "usage: $0 [all|macos|windows|linux]" >&2
  exit 1
}

tectonic_version=0.17.0
release_url="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$tectonic_version"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p src-tauri/binaries
corepack yarn install --immutable

if [[ $platform == all || $platform == macos ]]; then
  mac_target=aarch64-apple-darwin
  curl -fL "$release_url/tectonic-$tectonic_version-$mac_target.tar.gz" -o "$work_dir/tectonic-macos.tar.gz"
  tar -xzf "$work_dir/tectonic-macos.tar.gz" -C "$work_dir"
  install -m 755 "$work_dir/tectonic" "src-tauri/binaries/tectonic-$mac_target"
  CARGO_TARGET_DIR="$repo_dir/target/bundle/macos" \
    corepack yarn tauri build --config src-tauri/tauri.bundle.json --bundles app dmg
fi

if [[ $platform == all || $platform == windows ]]; then
  brew list llvm >/dev/null 2>&1 || brew install llvm
  brew list nsis >/dev/null 2>&1 || brew install nsis
  export PATH="$(brew --prefix llvm)/bin:$PATH"

  windows_target=x86_64-pc-windows-msvc
  rustup target add "$windows_target"
  command -v cargo-xwin >/dev/null || cargo install --locked cargo-xwin
  curl -fL "$release_url/tectonic-$tectonic_version-$windows_target.zip" -o "$work_dir/tectonic-windows.zip"
  unzip -q "$work_dir/tectonic-windows.zip" -d "$work_dir/windows"
  install -m 755 "$work_dir/windows/tectonic.exe" "src-tauri/binaries/tectonic-$windows_target.exe"
  CARGO_TARGET_DIR="$repo_dir/target/bundle/windows" \
    corepack yarn tauri build --config src-tauri/tauri.bundle.json \
      --runner cargo-xwin --target "$windows_target" --bundles nsis
fi

if [[ $platform == all || $platform == linux ]]; then
  docker build --platform linux/amd64 -t base6-techo-linux-builder - <<'EOF'
FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl file libappindicator3-dev librsvg2-dev \
      libssl-dev libwebkit2gtk-4.1-dev patchelf rpm \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
    && corepack enable \
    && for attempt in 1 2 3; do corepack prepare yarn@4.18.0 --activate && exit 0; sleep 5; done; exit 1
ENV PATH="/root/.cargo/bin:${PATH}"
EOF
  docker run --rm --platform linux/amd64 \
    -v "$repo_dir:/app" \
    -v base6-techo-linux-node-modules:/app/node_modules \
    -v base6-techo-linux-cargo-registry:/root/.cargo/registry \
    -w /app base6-techo-linux-builder bash scripts/package-linux.sh
fi

echo "macOS:  target/bundle/macos/release/bundle"
echo "Windows: target/bundle/windows/x86_64-pc-windows-msvc/release/bundle/nsis"
echo "Linux:   target/bundle/release/bundle"
