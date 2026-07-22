#!/usr/bin/env bun
/**
 * Add a stable `uuid` to every sentence object under docs/sentences/.
 *
 * Idempotent: objects that already have a `uuid` are left untouched, so this can
 * be re-run safely after new sentence files are added. The `uuid` key is
 * appended last, preserving the existing field order (disp, [kana], q, lang).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";

const SENTENCES_DIR = path.join(process.cwd(), "docs", "sentences");

interface SentenceObject {
  uuid?: string;
  [key: string]: unknown;
}

async function processFile(
  file: string,
): Promise<{ added: number; total: number }> {
  const arr = (await Bun.file(file).json()) as SentenceObject[];
  let added = 0;
  for (const obj of arr) {
    if (typeof obj.uuid !== "string" || obj.uuid.length === 0) {
      obj.uuid = crypto.randomUUID();
      added++;
    }
  }
  if (added > 0) {
    await Bun.write(file, `${JSON.stringify(arr, null, 2)}\n`);
  }
  return { added, total: arr.length };
}

async function main() {
  const categories = await readdir(SENTENCES_DIR, { withFileTypes: true });
  let files = 0;
  let totalAdded = 0;
  let totalObjects = 0;
  for (const cat of categories) {
    if (!cat.isDirectory()) continue;
    const dir = path.join(SENTENCES_DIR, cat.name);
    for (const name of await readdir(dir)) {
      if (!/^\d+\.json$/.test(name)) continue;
      const { added, total } = await processFile(path.join(dir, name));
      files++;
      totalAdded += added;
      totalObjects += total;
      console.log(`  ${cat.name}/${name}: +${added} uuid (${total} objects)`);
    }
  }
  console.log(
    `\n✅ ${files} files, ${totalObjects} objects, ${totalAdded} uuid added.`,
  );
}

await main();
