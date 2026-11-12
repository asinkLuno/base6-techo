import {
  BASE_URL,
  PLATFORMS,
  type Platform,
  REPOSITORY,
  type Release,
  type ReleaseAsset,
} from "./site";

const DOWNLOAD_PREFIX = `${REPOSITORY}/releases/download/`;

const ALLOWED_EXTENSIONS: Record<Platform, string[]> = {
  linux: [".deb", ".AppImage", ".rpm"],
  windows: [".msi", ".exe"],
  macos: [".dmg"],
  android: [".apk"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && PLATFORMS.includes(value as Platform);
}

function validAsset(value: unknown): value is ReleaseAsset {
  if (!isRecord(value)) return false;
  const {
    platform,
    kind,
    arch,
    name,
    size,
    sha256,
    download_url,
    checksum_url,
  } = value;
  if (!isPlatform(platform)) return false;
  if (typeof kind !== "string" || kind.length === 0) return false;
  if (typeof arch !== "string" || arch.length === 0) return false;
  if (typeof name !== "string" || !name.startsWith("base6-techo")) return false;
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0)
    return false;
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256))
    return false;
  if (typeof download_url !== "string") return false;
  if (!download_url.startsWith(DOWNLOAD_PREFIX)) return false;
  if (
    !ALLOWED_EXTENSIONS[platform].some((extension) =>
      download_url.endsWith(extension),
    )
  )
    return false;
  if (download_url.includes("..")) return false;
  if (
    typeof checksum_url !== "string" ||
    checksum_url !== `${download_url}.sha256`
  )
    return false;
  return true;
}

function validRelease(value: unknown): value is Release {
  if (!isRecord(value)) return false;
  const { tag, version, name, notes, published_at, assets } = value;
  if (typeof tag !== "string" || !/^v\d+\.\d+\.\d+/.test(tag)) return false;
  if (typeof version !== "string" || version.length === 0) return false;
  if (typeof name !== "string" || name.length === 0) return false;
  if (typeof notes !== "string") return false;
  if (
    typeof published_at !== "string" ||
    !Number.isFinite(Date.parse(published_at))
  )
    return false;
  if (!Array.isArray(assets) || assets.length === 0) return false;
  return assets.every(validAsset);
}

async function fetchJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export type ReleaseState = {
  latest: Release | null;
  history: Release[];
};

/**
 * 发布页读取构建时生成的 latest.json / releases.json。
 * 两份文件都由 scripts/pages-release.mjs 从 GitHub Releases 生成，不手工维护。
 */
export async function loadReleases(signal: AbortSignal): Promise<ReleaseState> {
  const latest = await fetchJson(`${BASE_URL}latest.json`, signal);
  if (!validRelease(latest)) throw new Error("latest.json 格式无效");

  let history: Release[] = [];
  try {
    const value = await fetchJson(`${BASE_URL}releases.json`, signal);
    if (Array.isArray(value)) history = value.filter(validRelease);
  } catch {
    // 历史版本缺失不影响下载最新版。
  }

  return { latest, history };
}
