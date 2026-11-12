#!/usr/bin/env node
/** Release builds must ship one version across npm, Tauri and Rust manifests. */
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readCargoVersion(path) {
  const section = readFileSync(path, "utf8")
    .split(/^\[/m)
    .find((part) => part.startsWith("package]"));
  const version = section?.match(/^version\s*=\s*"([^"]+)"/m);
  if (!version) throw new Error(`cannot read [package].version from ${path}`);
  return version[1];
}

const versions = {
  "package.json": readJson("package.json").version,
  "src-tauri/tauri.conf.json": readJson("src-tauri/tauri.conf.json").version,
  "src-tauri/Cargo.toml": readCargoVersion("src-tauri/Cargo.toml"),
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1) {
  console.error("version mismatch:");
  for (const [path, version] of Object.entries(versions))
    console.error(`  ${path}: ${version}`);
  process.exit(1);
}

const [version] = unique;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`invalid semver version: ${version}`);
  process.exit(1);
}
console.log(`version OK: ${version}`);
