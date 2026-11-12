#!/usr/bin/env node
/**
 * Generate the landing page release metadata from GitHub Releases.
 *
 *   node scripts/pages-release.mjs --output website/dist --tag v0.1.0
 *
 * The site only consumes the generated files, so release assets never have to
 * be described by hand. Every installer must have a matching `.sha256` asset;
 * the digest comes from the GitHub API when available (modern releases expose
 * it), otherwise we read the small checksum asset.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_REPO = "asinkLuno/base6-techo";
const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(
  /\/$/,
  "",
);
const ASSET_PREFIX = "base6-techo";
const MAX_RELEASES = 20;

const EXTENSIONS = {
  ".AppImage": { platform: "linux", kind: "appimage", arch: "x86_64" },
  ".deb": { platform: "linux", kind: "deb", arch: "x86_64" },
  ".rpm": { platform: "linux", kind: "rpm", arch: "x86_64" },
  ".exe": { platform: "windows", kind: "nsis", arch: "x64" },
  ".msi": { platform: "windows", kind: "msi", arch: "x64" },
  ".dmg": { platform: "macos", kind: "dmg", arch: null },
  ".apk": { platform: "android", kind: "apk", arch: "arm64" },
};

function parseArgs(argv) {
  const options = {
    output: null,
    tag: null,
    repo: DEFAULT_REPO,
    max: MAX_RELEASES,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    switch (arg) {
      case "--output":
        options.output = value;
        i += 1;
        break;
      case "--tag":
        options.tag = value;
        i += 1;
        break;
      case "--repo":
        options.repo = value;
        i += 1;
        break;
      case "--max":
        options.max = Number.parseInt(value, 10);
        i += 1;
        break;
      case "--help":
      case "-h":
        console.log(
          "Usage: node scripts/pages-release.mjs --output <dir> --tag <vX.Y.Z> [--repo owner/name] [--max N]",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!options.output) throw new Error("--output is required");
  if (!options.tag) throw new Error("--tag is required");
  if (!/^[^/]+\/[^/]+$/.test(options.repo))
    throw new Error(`invalid --repo: ${options.repo}`);
  if (!Number.isInteger(options.max) || options.max < 1)
    throw new Error("--max must be a positive integer");
  return options;
}

function extensionOf(name) {
  for (const extension of Object.keys(EXTENSIONS)) {
    if (name.endsWith(extension)) return extension;
  }
  return null;
}

function archOf(name, fallback) {
  if (/(?:^|[_-])(aarch64|arm64)(?:[_.-]|$)/i.test(name)) return "arm64";
  if (/(?:^|[_-])x86_64(?:[_.-]|$)/i.test(name)) return "x86_64";
  if (/(?:^|[_-])(x64|amd64)(?:[_.-]|$)/i.test(name)) return "x64";
  return fallback;
}

/** Return the site's asset description, or null for checksums / notes / unknown files. */
function classify(name) {
  if (!name.startsWith(ASSET_PREFIX)) return null;
  const extension = extensionOf(name);
  if (!extension) return null;
  const info = EXTENSIONS[extension];
  const arch = archOf(name, info.arch);
  if (!arch)
    throw new Error(`cannot determine architecture from asset name: ${name}`);
  return { platform: info.platform, kind: info.kind, arch };
}

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "base6-techo-pages-release",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    );
  return response;
}

async function readChecksum(asset, downloadHeaders) {
  const response = await request(asset.browser_download_url, downloadHeaders);
  const text = await response.text();
  const match = text.match(/(?:^|\s)([a-fA-F0-9]{64})(?:\s|$)/);
  if (!match) throw new Error(`no SHA-256 digest found in ${asset.name}`);
  return match[1].toLowerCase();
}

async function digestFor(asset, byName, downloadHeaders) {
  const apiDigest = typeof asset.digest === "string" ? asset.digest : "";
  if (/^sha256:[a-fA-F0-9]{64}$/.test(apiDigest))
    return apiDigest.slice(7).toLowerCase();
  const checksum = byName.get(`${asset.name}.sha256`);
  if (!checksum) throw new Error(`missing ${asset.name}.sha256 in the release`);
  return readChecksum(checksum, downloadHeaders);
}

async function releaseAssets(release, repo, downloadHeaders) {
  const byName = new Map(release.assets.map((asset) => [asset.name, asset]));
  const prefix = `https://github.com/${repo}/releases/download/${release.tag_name}/`;
  const assets = [];

  for (const asset of release.assets) {
    const kind = classify(asset.name);
    if (!kind) continue;
    if (!asset.browser_download_url.startsWith(prefix)) {
      throw new Error(
        `unexpected download URL for ${asset.name}: ${asset.browser_download_url}`,
      );
    }
    if (typeof asset.size !== "number" || asset.size <= 0) {
      throw new Error(`invalid size for ${asset.name}`);
    }
    assets.push({
      ...kind,
      name: asset.name,
      size: asset.size,
      sha256: await digestFor(asset, byName, downloadHeaders),
      download_url: asset.browser_download_url,
      checksum_url: `${asset.browser_download_url}.sha256`,
    });
  }

  return assets;
}

function toRelease(release, assets) {
  const version = release.tag_name.replace(/^v/, "");
  return {
    tag: release.tag_name,
    version,
    name: release.name || `${ASSET_PREFIX} v${version}`,
    notes: release.body || "",
    published_at: release.published_at ?? release.created_at,
    assets,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const headers = githubHeaders(token);
  const downloadHeaders = { ...headers, Accept: "application/octet-stream" };

  const url = `${API}/repos/${options.repo}/releases?per_page=100`;
  const releases = await (await request(url, headers)).json();
  if (!Array.isArray(releases))
    throw new Error("GitHub API did not return a release list");

  const published = releases.filter(
    (release) => !release.draft && !release.prerelease,
  );
  const target = published.find((release) => release.tag_name === options.tag);
  if (!target) throw new Error(`release ${options.tag} is not published`);

  const entries = [];
  for (const release of published.slice(0, options.max)) {
    const assets = await releaseAssets(release, options.repo, downloadHeaders);
    if (assets.length > 0) entries.push(toRelease(release, assets));
  }
  let latest = entries.find((entry) => entry.tag === options.tag);
  if (!latest) {
    const assets = await releaseAssets(target, options.repo, downloadHeaders);
    if (assets.length === 0) {
      throw new Error(`release ${options.tag} has no recognized installers`);
    }
    latest = toRelease(target, assets);
  }

  const history = entries;
  const output = options.output;
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "latest.json"),
    `${JSON.stringify(latest, null, 2)}\n`,
  );
  await writeFile(
    join(output, "releases.json"),
    `${JSON.stringify(history, null, 2)}\n`,
  );
  console.log(
    `wrote ${join(output, "latest.json")} (${latest.assets.length} assets) and ${join(output, "releases.json")}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
