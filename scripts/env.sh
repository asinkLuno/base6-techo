# Shared environment for Android/vcpkg builds. Source this from other scripts:
#   source "$(dirname "$0")/env.sh"
# Everything lives in user space (no root needed).

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

# Pick the newest side-by-side NDK (r29+ gives 16 KB page-size alignment for free)
export NDK_HOME="${NDK_HOME:-$ANDROID_HOME/ndk/$(ls -1 "$ANDROID_HOME/ndk" 2>/dev/null | sort -V | tail -1)}"
export ANDROID_NDK_HOME="$NDK_HOME"

export VCPKG_ROOT="${VCPKG_ROOT:-$HOME/vcpkg}"

export PATH="$HOME/.cargo/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/cmdline-tools/bin:$HOME/.local/bin:$PATH"

# Gradle 9.6 (tauri template) refuses JDK 27+; ship a user-space JDK 21.
if [ -d "$HOME/opt/jdk21" ]; then
  export JAVA_HOME="$HOME/opt/jdk21"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# vcpkg's autotools ports (gperf etc.) verify autoconf-archive macros via aclocal;
# we ship the m4 files in user space instead of pacman.
export ACLOCAL_PATH="${ACLOCAL_PATH:-$HOME/.local/share/aclocal}"

# tectonic C dependency backend:
#   - desktop (host) builds use pkg-config + system dev libs (freetype, harfbuzz,
#     fontconfig, graphite2, icu, libpng) — tectonic's Linux default
#   - android builds set TECTONIC_DEP_BACKEND=vcpkg in scripts/build-android.sh
#     (vcpkg arm64-android ports built by scripts/setup-android-env.sh)
# Do NOT export a backend here: a global value poisons host builds when the
# system libs are missing or the IDE (rust-analyzer) builds without it.

# Arm target used for the Android app (arm64-v8a device)
export TECTONIC_ABIS="arm64-v8a"

die() { echo "ERROR: $*" >&2; exit 1; }

require_env() {
  [ -d "$ANDROID_HOME" ] || die "ANDROID_HOME not found at $ANDROID_HOME"
  [ -d "$NDK_HOME" ] || die "NDK not found under $ANDROID_HOME/ndk (set NDK_HOME)"
  [ -x "$VCPKG_ROOT/vcpkg" ] || die "vcpkg not found at $VCPKG_ROOT (run scripts/setup-android-env.sh)"
}
