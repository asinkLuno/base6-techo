#!/usr/bin/env bash
set -euo pipefail

[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || {
  echo "package-linux.sh only supports Linux x86_64" >&2
  exit 1
}

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

target=x86_64-unknown-linux-gnu
tectonic_version=0.17.0
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p src-tauri/binaries

curl -fL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$tectonic_version/tectonic-$tectonic_version-$target.tar.gz" -o "$work_dir/tectonic.tar.gz"
tar -xzf "$work_dir/tectonic.tar.gz" -C "$work_dir"
install -m 755 "$work_dir/tectonic" "src-tauri/binaries/tectonic-$target"

corepack yarn install --immutable

export CARGO_TARGET_DIR="$repo_dir/target/bundle"
corepack yarn tauri build --config src-tauri/tauri.bundle.json --bundles deb rpm

echo "Packages: $CARGO_TARGET_DIR/release/bundle"
