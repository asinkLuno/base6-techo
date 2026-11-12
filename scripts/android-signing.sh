#!/usr/bin/env bash
# Restore the Android release signing material from CI secrets and validate it.
#
# Usage: scripts/android-signing.sh [--check-only] [--out-dir DIR]
#
# Required env (from repository Secrets; never generated here — a replacement
# certificate would break upgrades of already installed apps):
#   ANDROID_KEYSTORE_BASE64   base64 of the existing release keystore
#   ANDROID_KEY_ALIAS
#   ANDROID_KEYSTORE_PASSWORD
#   ANDROID_KEY_PASSWORD
#
# --check-only validates the keystore without writing keystore.properties, so
# the guard job can fail fast on a bad secret instead of after a full build.
set -euo pipefail

check_only=0
out_dir="src-tauri/gen/android/app"
while [ $# -gt 0 ]; do
  case "$1" in
    --check-only) check_only=1; shift ;;
    --out-dir)
      out_dir="${2:?--out-dir needs a value}"
      shift 2
      ;;
    -h | --help)
      echo "usage: $0 [--check-only] [--out-dir DIR]"
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

for variable in ANDROID_KEYSTORE_BASE64 ANDROID_KEY_ALIAS ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "::error::Missing signing secret: $variable. Use the existing keystore; never generate a replacement." >&2
    exit 1
  fi
done

# Report stray whitespace without echoing any secret value: a trailing newline
# pasted into a Secret is invisible in the UI but breaks keytool.
for variable in ANDROID_KEY_ALIAS ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD; do
  value="${!variable}"
  trimmed="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ "$value" != "$trimmed" ]; then
    echo "::warning::$variable has leading or trailing whitespace; the keystore check may fail even if the value is otherwise correct." >&2
  fi
done

mkdir -p "$out_dir"
umask 077
keystore="$out_dir/release.jks"
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore"

# keytool writes its diagnostics to stdout; show them on failure instead of
# discarding them (a wrong alias and a wrong password look identical otherwise).
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if ! keytool -list -keystore "$keystore" -alias "$ANDROID_KEY_ALIAS" \
  -storepass:env ANDROID_KEYSTORE_PASSWORD >"$log" 2>&1; then
  cat "$log"
  echo "::error::Cannot open the release keystore. Check ANDROID_KEY_ALIAS, ANDROID_KEYSTORE_PASSWORD and that ANDROID_KEYSTORE_BASE64 is the existing certificate; never generate a replacement." >&2
  exit 1
fi
echo "release keystore OK: alias $ANDROID_KEY_ALIAS"

if [ "$check_only" -eq 1 ]; then
  exit 0
fi

{
  printf 'storeFile=release.jks\n'
  printf 'storePassword=%s\n' "$ANDROID_KEYSTORE_PASSWORD"
  printf 'keyAlias=%s\n' "$ANDROID_KEY_ALIAS"
  printf 'keyPassword=%s\n' "$ANDROID_KEY_PASSWORD"
} >"$out_dir/keystore.properties"
