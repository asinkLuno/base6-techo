#!/usr/bin/env bash
# Shrink vcpkg's static ICU data archives to what XeTeX + HarfBuzz actually use.
#
# ICU's full data package (libicudata.a, ~33 MiB) ships every locale, collation,
# timezone, RBNF, transliteration and unit table. This app's compile path only
# touches:
#   - brkitr/*        line-break rules + dictionaries (incl. cjdict for Chinese)
#   - *.cnv           \XeTeXinputencoding converters
#   - cnvalias.icu    converter name aliases (GBK, Big5, Shift_JIS, ...)
#   - root/en/en_US/en_US_POSIX/zh/zh_Hant/res_index/pool/supplementalData
#   - uemoji.icu, ulayout.icu
# Core Unicode properties, case mapping, normalization (NFC) and bidi are
# compiled into libicuuc, not carried in the data package (ICU 79).
#
# The trimmed archive is ~9 MiB. This is a no-op for desktop Linux builds that
# dynamically link the system ICU (no ICU data is shipped there anyway), but it
# applies to every vcpkg triplet, so Android (and any static desktop build) uses
# the same trimmed data.
#
# Usage:
#   scripts/trim-icu-data.sh [--restore] [triplet ...]
#   default triplets: arm64-android x64-linux
#
# Requires a prior `vcpkg install icu:<triplet>` (the data package and host
# icupkg/genccode tools live under $VCPKG_ROOT/buildtrees/icu). Idempotent:
# already-trimmed archives are detected by size. The original archive is kept
# next to it as libicudata.a.orig; --restore puts it back.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/env.sh

RESTORE=0
TRIPLETS=()
for a in "$@"; do
  case "$a" in
    --restore) RESTORE=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) TRIPLETS+=("$a") ;;
  esac
done
((${#TRIPLETS[@]})) || TRIPLETS=(arm64-android x64-linux)

# A full ICU data archive is ~33 MiB; the trimmed one is ~9 MiB.
FULL_THRESHOLD=$((20 * 1024 * 1024))
# Set when this run actually replaced an installed archive (see the marker at
# the end of the script).
TRIMMED=0

die() { echo "ERROR: $*" >&2; exit 1; }

find_host_tool() {
  local name=$1 cand
  for cand in \
      "$VCPKG_ROOT/buildtrees/icu/x64-linux-rel/bin/$name" \
      "$VCPKG_ROOT/buildtrees/icu/x64-linux-dbg/bin/$name"; do
    [[ -x $cand ]] && { echo "$cand"; return 0; }
  done
  cand=$(find "$VCPKG_ROOT/buildtrees/icu" -path '*/bin/*' -name "$name" -type f -perm -u+x 2>/dev/null | head -1 || true)
  [[ -n $cand ]] || die "$name not found under $VCPKG_ROOT/buildtrees/icu (run scripts/setup-android-env.sh first)"
  echo "$cand"
}

restore_triplet() {
  local triplet=$1 sub lib
  for sub in lib debug/lib; do
    lib="$VCPKG_ROOT/installed/$triplet/$sub/libicudata.a"
    if [[ -f "$lib.orig" ]]; then
      mv -f "$lib.orig" "$lib"
      echo "  $triplet/$sub: restored original libicudata.a"
    fi
  done
}

needs_trim() {
  local triplet=$1 sub lib
  for sub in lib debug/lib; do
    lib="$VCPKG_ROOT/installed/$triplet/$sub/libicudata.a"
    [[ -f $lib ]] || continue
    (($(stat -c%s "$lib") >= FULL_THRESHOLD)) && return 0
  done
  return 1
}

build_trimmed_archive() {
  local triplet=$1
  local rel_dir="$VCPKG_ROOT/buildtrees/icu/${triplet}-rel/data/out/tmp"
  local dat dat_base pkg entry gen_s entry_prefix stem work major
  local before after total kept

  dat=$(find "$rel_dir" -maxdepth 1 -name 'icudt*.dat' 2>/dev/null | head -1 || true)
  [[ -n $dat ]] || die "ICU data package for $triplet not found under $rel_dir (run setup-android-env.sh or vcpkg install icu:$triplet)"
  dat_base=$(basename "$dat")        # e.g. icudt79l.dat
  pkg=${dat_base%.dat}               # e.g. icudt79l (TOC prefix / package name)

  # The data entry-point symbol (icudt79_dat) is written into the .S next to the
  # dat during vcpkg's ICU build; reuse it instead of guessing.
  gen_s=$(find "$rel_dir" -maxdepth 1 -name '*_dat.S' 2>/dev/null | head -1 || true)
  entry=""
  if [[ -n $gen_s ]]; then
    entry=$(grep -m1 -E '^\.globl ' "$gen_s" | awk '{print $2}' || true)
  fi
  if [[ -z $entry ]]; then
    major=$(echo "$pkg" | sed -E 's/^icudt([0-9]+).*/\1/')
    entry="icudt${major}_dat"
  fi
  entry_prefix=${entry%_dat}

  work="$PWD/build/icu-trim/${triplet}-rel"
  rm -rf "$work"
  mkdir -p "$work"

  # Everything not in this keep set is dropped.
  "$ICUPKG" -l "$dat" | awk '
    /^brkitr\// { next }
    /\.cnv$/ { next }
    $0 == "cnvalias.icu" || $0 == "root.res" || $0 == "en.res" ||
    $0 == "en_US.res" || $0 == "en_US_POSIX.res" || $0 == "zh.res" ||
    $0 == "zh_Hant.res" || $0 == "res_index.res" || $0 == "pool.res" ||
    $0 == "supplementalData.res" || $0 == "uemoji.icu" || $0 == "ulayout.icu" { next }
    { print }
  ' > "$work/remove.txt"

  total=$("$ICUPKG" -l "$dat" | grep -c . || true)
  removed=$(grep -c . "$work/remove.txt" || true)
  kept=$((total - removed))
  ((kept > 0)) || die "keep list is empty for $triplet"

  # The output file must keep the package's base name. icupkg derives the new
  # TOC prefix from the output filename; a different name (e.g. icudt79l-trimmed.dat)
  # makes every resource lookup fail with U_MISSING_RESOURCE_ERROR.
  "$ICUPKG" -r "$work/remove.txt" "$dat" "$work/$dat_base"
  # icupkg -l strips the TOC prefix, so check the raw bytes: the output file
  # name must match the package name, or ICU will not find any resource.
  grep -aq -- "$pkg/brkitr/" "$work/$dat_base" \
    || die "trimmed package lost its TOC prefix ($pkg/); check the output filename"

  "$GENCODE" -a gcc -n "$entry_prefix" -e "$entry_prefix" -d "$work" "$work/$dat_base" >/dev/null

  local cc ar
  case "$triplet" in
    arm64-android)
      cc="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang"
      ar="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
      ;;
    x64-linux|x86_64-linux)
      cc=${CC:-cc}
      ar=${AR:-ar}
      ;;
    *) die "unsupported triplet '$triplet' (add its CC/AR mapping to this script)" ;;
  esac

  "$cc" -O2 -fPIC -c "$work/${dat_base%.dat}_dat.S" -o "$work/data.o"
  rm -f "$work/libicudata.a"
  "$ar" rcs "$work/libicudata.a" "$work/data.o"

  before=$(stat -c%s "$dat")
  after=$(stat -c%s "$work/libicudata.a")
  ((after < before)) || die "trimmed archive ($after B) is not smaller than full data ($before B)"
  echo "  $triplet: data $(numfmt --to=iec-i --suffix=B "$before") -> $(numfmt --to=iec-i --suffix=B "$after") (kept $kept/$total items)"
}

install_triplet() {
  local triplet=$1 work sub lib size
  work="$PWD/build/icu-trim/${triplet}-rel"
  for sub in lib debug/lib; do
    lib="$VCPKG_ROOT/installed/$triplet/$sub/libicudata.a"
    [[ -f $lib ]] || continue
    size=$(stat -c%s "$lib")
    if ((size < FULL_THRESHOLD)); then
      echo "  $triplet/$sub: already trimmed ($(numfmt --to=iec-i --suffix=B "$size")), skipping"
      continue
    fi
    [[ -f "$lib.orig" ]] || cp -p "$lib" "$lib.orig"
    cp "$work/libicudata.a" "$lib.tmp"
    mv "$lib.tmp" "$lib"
    TRIMMED=1
    echo "  $triplet/$sub: installed $(numfmt --to=iec-i --suffix=B "$(stat -c%s "$lib")") (was $(numfmt --to=iec-i --suffix=B "$size"); original kept at libicudata.a.orig)"
  done
}

if ((RESTORE)); then
  for t in "${TRIPLETS[@]}"; do restore_triplet "$t"; done
  exit 0
fi

for t in "${TRIPLETS[@]}"; do
  if needs_trim "$t"; then
    # Resolve the host tools lazily: when every archive is already trimmed this
    # script must still succeed on machines whose vcpkg buildtrees were cleaned.
    ICUPKG=$(find_host_tool icupkg)
    GENCODE=$(find_host_tool genccode)
    echo "== trimming ICU data for $t =="
    build_trimmed_archive "$t"
    install_triplet "$t"
  else
    echo "== $t: ICU data already trimmed, nothing to do =="
  fi
done

# Machine-readable marker for build scripts that must force a relink: cargo
# does not track vcpkg's static archives, so replacing libicudata.a alone does
# not invalidate the previous link of the app's cdylib.
if ((TRIMMED)); then
  echo "ICU_DATA_TRIMMED=1"
fi
