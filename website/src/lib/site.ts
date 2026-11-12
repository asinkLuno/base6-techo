export const REPOSITORY = "https://github.com/asinkLuno/base6-techo";
export const RELEASES_URL = `${REPOSITORY}/releases`;
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
export const ISSUES_URL = `${REPOSITORY}/issues`;
export const EXAMPLES_URL = `${REPOSITORY}/tree/master/examples`;
export const RELEASE_NOTES_URL = `${REPOSITORY}/blob/master/release-notes.md`;
export const BASE_URL = import.meta.env.BASE_URL;

export const PLATFORMS = ["linux", "windows", "macos", "android"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type ReleaseAsset = {
  platform: Platform;
  kind: string;
  arch: string;
  name: string;
  size: number;
  sha256: string;
  download_url: string;
  checksum_url: string;
};

export type Release = {
  tag: string;
  version: string;
  name: string;
  notes: string;
  published_at: string;
  assets: ReleaseAsset[];
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  linux: "Linux",
  windows: "Windows",
  macos: "macOS",
  android: "Android",
};

export const PLATFORM_REQUIREMENTS: Record<Platform, string> = {
  linux: "x86_64 · 主流 glibc 发行版",
  windows: "Windows 10 / 11 · x64",
  macos: "macOS 11 及以上 · Apple Silicon 或 Intel",
  android: "Android 7.0 及以上 · arm64-v8a",
};

const PREFERRED_KIND: Record<Platform, string[]> = {
  linux: ["appimage", "deb", "rpm"],
  windows: ["nsis", "msi"],
  macos: ["dmg"],
  android: ["apk"],
};

export function sortAssets(
  platform: Platform,
  assets: ReleaseAsset[],
): ReleaseAsset[] {
  const order = PREFERRED_KIND[platform];
  return [...assets].sort((a, b) => {
    const ai = order.indexOf(a.kind);
    const bi = order.indexOf(b.kind);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.arch.localeCompare(b.arch);
  });
}

export function assetLabel(asset: ReleaseAsset): string {
  switch (asset.kind) {
    case "appimage":
      return "AppImage";
    case "deb":
      return ".deb";
    case "rpm":
      return ".rpm";
    case "nsis":
      return "安装程序 .exe";
    case "msi":
      return ".msi";
    case "dmg":
      if (asset.arch === "arm64" || asset.arch === "aarch64")
        return "DMG · Apple Silicon";
      if (asset.arch === "x86_64" || asset.arch === "x64") return "DMG · Intel";
      return "DMG · Universal";
    case "apk":
      return "APK · arm64";
    default:
      return asset.kind;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}
