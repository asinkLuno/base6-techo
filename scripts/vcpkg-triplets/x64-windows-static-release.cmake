# Tectonic's Windows triplet: static CRT + static libraries, release only.
# Copied from tectonic-typesetting/tectonic `dist/vcpkg-triplets` so the
# tectonic crate's vcpkg backend can find `x64-windows-static-release`.
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE static)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_BUILD_TYPE release)
