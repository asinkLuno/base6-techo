#!/usr/bin/env node
/** Write `<artifact>.sha256` files (sha256sum format) for every file in a directory. */
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2] ?? "artifacts/ci";
const entries = await readdir(directory, { withFileTypes: true });
let count = 0;

for (const entry of entries) {
  if (!entry.isFile() || entry.name.endsWith(".sha256")) continue;
  const path = join(directory, entry.name);
  const info = await stat(path);
  if (info.size === 0) throw new Error(`${path} is empty`);
  const hash = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  await writeFile(`${path}.sha256`, `${hash}  ${entry.name}\n`);
  console.log(`${hash}  ${entry.name}`);
  count += 1;
}

if (count === 0) throw new Error(`no artifacts found in ${directory}`);
