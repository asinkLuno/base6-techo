#!/usr/bin/env bash
# Android-safety patches for tectonic's cargo-registry sources.
#
# The registry cache is shared by all projects on this machine; these patches
# are safe to apply globally (both fix real crashes on Android's Scudo
# allocator). Idempotent: safe to re-run, verifies its own work.
#
# Run this after `cargo fetch` and BEFORE the first cargo build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/env.sh

REG="${CARGO_HOME:-$HOME/.cargo}/registry/src"

echo "== patch 1/2: engine_xetex print_glyph_name (Scudo interior-pointer free) =="
# Fixed UPSTREAM in tectonic_engine_xetex 0.5.3 (tectonic PR #1353): the loop no
# longer advances `s` before freeGlyphName(). For older 0.5.x, apply TeXslate's
# fix; on 0.5.3+ just assert the buggy pattern is absent.
shopt -s nullglob
for f in "$REG"/*/tectonic_engine_xetex-*/xetex/xetex-ext.c; do
  if grep -q "SCUDO print_glyph_name fix" "$f"; then
    echo "  already patched: $f"
  elif grep -q "print_char(\*s++);" "$f"; then
    perl -0777 -pi -e 's#\n([ \t]*)while \(len-- > 0\)\n[ \t]*print_char\(\*s\+\+\);#\n${1}{ /* SCUDO print_glyph_name fix: print via copy, free the original pointer (Android/Scudo aborts on the interior free) */ const char* p = s; while (len-- > 0) print_char(*p++); }#' "$f"
    grep -q "SCUDO print_glyph_name fix" "$f" \
      || { echo "ERROR: print_glyph_name patch did not apply to $f" >&2; exit 1; }
    echo "  patched: $f"
  else
    echo "  not needed (upstream fix present): $f"
  fi
done

echo "== patch 2/2: bridge_core output_close double-close =="
# C code may close the same output twice; take().unwrap() then panics — and a
# panic crossing the extern "C" boundary aborts the process (no catch_unwind
# can save it). Fix both the double-close and the FFI boundary.
for f in "$REG"/*/tectonic_bridge_core-*/src/lib.rs; do
  if grep -q "double-close fix" "$f"; then
    echo "  already patched: $f"
  else
    # (a) make output_close None-safe instead of take().unwrap()
    perl -0777 -pi -e 's#let mut oh = self\.output_handles\[id\.idx\(\)\]\.take\(\)\.unwrap\(\);#/* double-close fix */\n        let mut oh = match self.output_handles.get_mut(id.idx()).and_then(|s| s.take()) { Some(h) => h, None => return false };#' "$f"
    # (b) no panic may cross this extern "C" boundary
    perl -0777 -pi -e 's#\{\n    match handle \{\n        Some\(handle\) => libc::c_int::from\(es\.output_close\(handle\)\),\n        None => 0, // This is/was the behavior of close_file\(\) in C\.\n    \}\n\}#{\n    // double-close fix: no panic may cross this extern "C" boundary\n    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match handle {\n        Some(handle) => libc::c_int::from(es.output_close(handle)),\n        None => 0,\n    }))\n    .unwrap_or(1)\n}#' "$f"
    grep -q "double-close fix" "$f" \
      || { echo "ERROR: output_close patch did not apply to $f (source layout changed?)" >&2; exit 1; }
    echo "  patched: $f"
  fi
done
shopt -u nullglob

echo "== clearing stale build caches of patched crates =="
# cargo never re-reads registry sources once built — nuke any cached builds.
for crate in tectonic_bridge_core tectonic_engine_xetex; do
  find target -type d -name "${crate}-*" -exec rm -rf {} + 2>/dev/null || true
done

echo "== patches OK =="
