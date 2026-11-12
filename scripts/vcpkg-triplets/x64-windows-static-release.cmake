# Tectonic's Windows triplet: static libraries, release only.
#
# The name comes from tectonic-typesetting/tectonic `dist/vcpkg-triplets`, but
# its CRT linkage is changed to dynamic: Rust's MSVC toolchain links the app
# with /MD, and the linker rejects objects built with /MT (`LNK2038`). Static
# libraries still get linked into the executable; only the C runtime is shared,
# which the Tauri app already depends on.
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_BUILD_TYPE release)
