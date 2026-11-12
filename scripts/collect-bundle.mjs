#!/usr/bin/env node
/**
 * Copy Tauri bundle outputs to the flat, deterministic names the landing page
 * expects:
 *
 *   base6-techo_<version>_<platform>_<arch><extension>
 *
 * Usage: node scripts/collect-bundle.mjs --platform linux --version 0.1.0 --out artifacts/ci
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const BUNDLE_DIR = join("src-tauri", "target", "release", "bundle");

const KINDS = {
  linux: [
    { dir: "appimage", extension: ".AppImage" },
    { dir: "deb", extension: ".deb" },
    { dir: "rpm", extension: ".rpm" },
  ],
  windows: [
    { dir: "nsis", extension: ".exe" },
    { dir: "msi", extension: ".msi" },
  ],
  macos: [{ dir: "dmg", extension: ".dmg" }],
};

function parseArgs(argv) {
  const options = {
    platform: null,
    version: null,
    arch: null,
    out: "artifacts/ci",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case "--platform":
        options.platform = value;
        i += 1;
        break;
      case "--version":
        options.version = value;
        i += 1;
        break;
      case "--arch":
        options.arch = value;
        i += 1;
        break;
      case "--out":
        options.out = value;
        i += 1;
        break;
      default:
        throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  if (!options.platform || !(options.platform in KINDS)) {
    throw new Error(
      `--platform must be one of: ${Object.keys(KINDS).join(", ")}`,
    );
  }
  if (!options.version) throw new Error("--version is required");
  options.arch ??= options.platform === "windows" ? "x64" : "x86_64";
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.out, { recursive: true });

  let copied = 0;
  for (const kind of KINDS[options.platform]) {
    const sourceDir = join(BUNDLE_DIR, kind.dir);
    let names;
    try {
      names = await readdir(sourceDir);
    } catch {
      continue;
    }
    const matches = names.filter((name) => extname(name) === kind.extension);
    if (matches.length === 0) continue;
    if (matches.length > 1) {
      throw new Error(
        `expected one ${kind.extension} bundle in ${sourceDir}, found ${matches.length}`,
      );
    }
    const source = join(sourceDir, matches[0]);
    const target = join(
      options.out,
      `base6-techo_${options.version}_${options.platform}_${options.arch}${kind.extension}`,
    );
    await copyFile(source, target);
    console.log(`${basename(source)} -> ${basename(target)}`);
    copied += 1;
  }

  if (copied === 0)
    throw new Error(`no ${options.platform} bundles found under ${BUNDLE_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
