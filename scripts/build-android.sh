#!/usr/bin/env bash
# Cross-compile the app for Android (arm64-v8a) and produce an APK.
# Usage: build-android.sh [--release]
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/env.sh
require_env

MODE=debug
for a in "$@"; do
  case "$a" in
    --release) MODE=release ;;
    *) echo "unknown arg: $a"; exit 2 ;;
  esac
done

export VCPKGRS_TRIPLET=arm64-android
export VCPKG_ROOT="$VCPKG_ROOT"
# tectonic's C deps for the cross target come from vcpkg arm64-android
export TECTONIC_DEP_BACKEND=vcpkg

# cc-crate/build-script toolchain vars (what cargo-ndk would inject; the tauri
# CLI sets the final linker itself).
TOOLCHAIN="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin"
export CC_aarch64_linux_android="$TOOLCHAIN/aarch64-linux-android24-clang"
export CXX_aarch64_linux_android="$TOOLCHAIN/aarch64-linux-android24-clang++"
export AR_aarch64_linux_android="$TOOLCHAIN/llvm-ar"
export RANLIB_aarch64_linux_android="$TOOLCHAIN/llvm-ranlib"

# HarfBuzz/ICU are C++ — the NDK C++ runtime must ship inside the APK.
# (tauri CLI also symlinks it here; rm first so re-runs never hit "same file".)
JNILIBS="src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$JNILIBS"
rm -f "$JNILIBS/libc++_shared.so"
cp -fL "$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" "$JNILIBS/"

# ICU's full data package is ~33 MiB; only brkitr/converters/locale core are
# used by XeTeX. Trim the vcpkg arm64-android archive before linking (idempotent).
TRIM_OUT=$(scripts/trim-icu-data.sh arm64-android)
printf '%s\n' "$TRIM_OUT"

# cargo does not track vcpkg's static archives, so swapping libicudata.a does
# not invalidate the previous link. Force a relink when the archive changed
# (first build after a vcpkg (re)install); otherwise the .so would silently
# keep the old full ICU data.
if grep -q '^ICU_DATA_TRIMMED=1$' <<<"$TRIM_OUT"; then
  echo "== ICU data changed: forcing relink of the app library =="
  if [ "$MODE" = release ]; then
    (cd src-tauri && cargo clean -p base6-techo --release --target aarch64-linux-android)
  else
    (cd src-tauri && cargo clean -p base6-techo --target aarch64-linux-android)
  fi
fi

if [ "$MODE" = release ]; then
  yarn tauri android build --target aarch64 --apk
  echo "== APK: src-tauri/gen/android/app/build/outputs/apk/universal/release/ =="
else
  yarn tauri android build --target aarch64 --debug --apk
  echo "== APK: src-tauri/gen/android/app/build/outputs/apk/universal/debug/ =="
fi
