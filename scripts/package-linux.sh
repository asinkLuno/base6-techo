#!/usr/bin/env bash
set -euo pipefail

[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || {
  echo "package-linux.sh only supports Linux x86_64" >&2
  exit 1
}

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

python_build=3.13.15+20260825
python_tag=20260825
target=x86_64-unknown-linux-gnu
tectonic_version=0.17.0
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p src-tauri/pyembed src-tauri/binaries
curl -fL "https://github.com/astral-sh/python-build-standalone/releases/download/$python_tag/cpython-$python_build-$target-install_only_stripped.tar.gz" -o "$work_dir/python.tar.gz"
tar -xzf "$work_dir/python.tar.gz" -C src-tauri/pyembed

curl -fL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$tectonic_version/tectonic-$tectonic_version-$target.tar.gz" -o "$work_dir/tectonic.tar.gz"
tar -xzf "$work_dir/tectonic.tar.gz" -C "$work_dir"
install -m 755 "$work_dir/tectonic" "src-tauri/binaries/tectonic-$target"

PYTAURI_STANDALONE=1 uv pip install --exact \
  --python src-tauri/pyembed/python/bin/python3 \
  --reinstall-package base6-techo ./src-tauri

corepack yarn install --immutable

export PYO3_PYTHON
PYO3_PYTHON=$(realpath src-tauri/pyembed/python/bin/python3)
export RUSTFLAGS="-C link-arg=-Wl,-rpath,\$ORIGIN/../lib/base6-techo/lib -L $(realpath src-tauri/pyembed/python/lib)"
export CARGO_TARGET_DIR="$repo_dir/target/bundle"
corepack yarn tauri build --config src-tauri/tauri.bundle.json --bundles deb rpm

echo "Packages: $CARGO_TARGET_DIR/release/bundle"
