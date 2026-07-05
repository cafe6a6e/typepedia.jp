/** Discover the available <category>/<int>.json sentence files. */
import type { SentenceFileRef } from "@/types";

const SENTENCES_DIR = "public/sentences";

/** Sorted list of every sentence file under a category folder. */
export function listSentenceFiles(): SentenceFileRef[] {
  const glob = new Bun.Glob("*/*.json");
  const refs: SentenceFileRef[] = [];
  for (const rel of glob.scanSync(SENTENCES_DIR)) {
    const m = rel.match(/^([^/]+)[/](\d+)\.json$/);
    if (m) refs.push({ category: m[1], id: Number.parseInt(m[2], 10) });
  }
  return refs.sort((a, b) =>
    a.category === b.category
      ? a.id - b.id
      : a.category.localeCompare(b.category),
  );
}

/** Serve a sentence file, validating category and file name against traversal. */
export async function serveSentenceFile(
  category: string,
  file: string,
): Promise<Response> {
  if (!/^[A-Za-z0-9_-]+$/.test(category) || !/^\d+\.json$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const f = Bun.file(`${SENTENCES_DIR}/${category}/${file}`);
  if (!(await f.exists())) return new Response("Not found", { status: 404 });
  return new Response(f, { headers: { "Content-Type": "application/json" } });
}
