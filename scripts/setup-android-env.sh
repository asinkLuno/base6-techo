#!/usr/bin/env bash
# One-time (idempotent) setup of the Android cross-compile toolchain, user space only.
# Safe to re-run: every step checks before installing.
set -euo pipefail
cd "$(dirname "$0")"
source ./env.sh

echo "== 1. Android SDK components =="
# sdkmanager only works from cmdline-tools/latest/ — normalize older layouts
if [ -d "$ANDROID_HOME/cmdline-tools/bin" ] && [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  mv "$ANDROID_HOME/cmdline-tools/"{bin,lib,NOTICE.txt,source.properties} "$ANDROID_HOME/cmdline-tools/latest/" 2>/dev/null || true
fi
if [ ! -d "$ANDROID_HOME/platform-tools" ] || [ ! -d "$ANDROID_HOME/platforms/android-35" ] || [ ! -d "$ANDROID_HOME/build-tools/35.0.0" ]; then
  # "yes |" trips `set -o pipefail` with SIGPIPE when sdkmanager exits — swallow it,
  # and verify real results below instead.
  { yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null; } || true
  { yes | sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-35" "build-tools;35.0.0"; } || true
  [ -d "$ANDROID_HOME/platform-tools" ] || die "platform-tools install failed"
  [ -d "$ANDROID_HOME/platforms/android-35" ] || die "platforms;android-35 install failed"
  [ -d "$ANDROID_HOME/build-tools/35.0.0" ] || die "build-tools install failed"
else
  echo "already installed, skipping"
fi

echo "== 2. Rust android targets =="
for t in aarch64-linux-android x86_64-linux-android; do
  rustup target list --installed | grep -qx "$t" || rustup target add "$t"
done
echo "targets present"

echo "== 3. cargo-ndk =="
if ! command -v cargo-ndk >/dev/null 2>&1; then
  cargo install cargo-ndk --locked
else
  echo "already installed, skipping"
fi

echo "== 4. vcpkg =="
if [ ! -x "$VCPKG_ROOT/vcpkg" ]; then
  git clone --depth 1 https://github.com/microsoft/vcpkg "$VCPKG_ROOT"
  "$VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics
else
  echo "already bootstrapped, skipping"
fi

echo "== 5. host autotools extras (no root) =="
# gperf built from source (vcpkg's fontconfig/harfbuzz chain needs it on PATH)
if ! command -v gperf >/dev/null 2>&1; then
  mkdir -p "$HOME/.local/src" "$HOME/.local"
  if [ ! -x "$HOME/.local/src/gperf-3.1/src/gperf" ]; then
    curl -fsSL -o /tmp/gperf.tar.gz https://ftp.gnu.org/gnu/gperf/gperf-3.1.tar.gz
    tar -xf /tmp/gperf.tar.gz -C "$HOME/.local/src"
    (cd "$HOME/.local/src/gperf-3.1" && ./configure --prefix="$HOME/.local" --silent && make -j"$(nproc)" --silent >/dev/null && make install --silent >/dev/null)
  fi
  echo "gperf built into ~/.local"
else
  echo "gperf already installed, skipping"
fi
# autoconf-archive m4 macro library: vcpkg's gperf port runs `aclocal --dry-run`
# and aborts if AX_* macros are missing. Pure m4 files — just copy them.
if ! echo "$ACLOCAL_PATH" | grep -q "local/share/aclocal"; then
  echo "WARNING: ACLOCAL_PATH not set — source scripts/env.sh before building" >&2
fi
if [ ! -f "$HOME/.local/share/aclocal/ax_pthread.m4" ]; then
  mkdir -p "$HOME/.local/share/aclocal"
  ACA_VER=2024.10.16
  curl -fsSL -o /tmp/aca.tar.xz "https://mirrors.ustc.edu.cn/gnu/autoconf-archive/autoconf-archive-$ACA_VER.tar.xz" \
    || curl -fsSL -o /tmp/aca.tar.xz "https://ftp.gnu.org/gnu/autoconf-archive/autoconf-archive-$ACA_VER.tar.xz"
  tar -xf /tmp/aca.tar.xz -C /tmp
  cp /tmp/autoconf-archive-$ACA_VER/m4/*.m4 "$HOME/.local/share/aclocal/"
  echo "autoconf-archive m4 files installed"
else
  echo "autoconf-archive already installed, skipping"
fi

echo "== 6. vcpkg C dependencies for tectonic =="
# arm64-android -> the real device. This is the multi-hour step (ICU!).
if ! "$VCPKG_ROOT/vcpkg" list --triplet arm64-android 2>/dev/null | grep -q "^fontconfig"; then
  ANDROID_NDK_HOME="$NDK_HOME" "$VCPKG_ROOT/vcpkg" install \
    --triplet arm64-android \
    "harfbuzz[core,freetype,graphite2,icu,png]" freetype graphite2 icu libpng fontconfig
else
  echo "arm64-android deps already installed, skipping"
fi

echo "== setup done =="
echo "NOTE: vcpkg x64-linux (desktop) deps are installed on demand by build scripts."
