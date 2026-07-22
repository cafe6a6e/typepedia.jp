#!/usr/bin/env bun
import { build, type BuildConfig } from "bun";
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import path from "path";

// Print help text if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --source-map <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --source-map=linked --external=react,react-dom
`);
  process.exit(0);
}

// Helper function to convert kebab-case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

// Helper function to parse a value into appropriate type
const parseValue = (value: string): any => {
  // Handle true/false strings
  if (value === "true") return true;
  if (value === "false") return false;

  // Handle numbers
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  // Handle arrays (comma-separated)
  if (value.includes(",")) return value.split(",").map((v) => v.trim());

  // Default to string
  return value;
};

// Magical argument parser that converts CLI args to BuildConfig
function parseArgs(): Partial<BuildConfig> {
  const config: Record<string, any> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    // Handle --no-* flags
    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    // Handle --flag (boolean true)
    if (
      !arg.includes("=") &&
      (i === args.length - 1 || args[i + 1].startsWith("--"))
    ) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    // Handle --key=value or --key value
    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2);
    } else {
      key = arg.slice(2);
      value = args[++i];
    }

    // Convert kebab-case key to camelCase
    key = toCamelCase(key);

    // Handle nested properties (e.g. --minify.whitespace)
    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".");
      config[parentKey] = config[parentKey] || {};
      config[parentKey][childKey] = parseValue(value);
    } else {
      config[key] = parseValue(value);
    }
  }

  return config as Partial<BuildConfig>;
}

// Helper function to format file sizes
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

console.log("\n🚀 Starting build process...\n");

// Parse CLI arguments with our magical parser
const cliConfig = parseArgs();
// Default output is docs/ so GitHub Pages can serve it directly.
const outdir = cliConfig.outdir || path.join(process.cwd(), "docs");

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning build artifacts in ${outdir} (keeping sentences/)`);
  for (const entry of await readdir(outdir)) {
    if (entry === "sentences") continue;
    await rm(path.join(outdir, entry), { recursive: true, force: true });
  }
}

const start = performance.now();

// Scan for all HTML files in the project
const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
  .map((a) => path.resolve("src", a))
  .filter((dir) => !dir.includes("node_modules"));
console.log(
  `📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`,
);

// Build all the HTML files
const result = await build({
  entrypoints,
  outdir,
  plugins: [plugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  ...cliConfig, // Merge in any CLI-provided options
});

// Print the results
const end = performance.now();

const outputTable = result.outputs.map((output) => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
  Size: formatFileSize(output.size),
}));

console.table(outputTable);

// ---- Static hosting assets (GitHub Pages) ---------------------------------
// The sentence JSON already lives in docs/sentences/ (committed source of truth).
// Regenerate the static manifest that replaces the dynamic /api/sentences listing.
const sentencesRoot = path.join(outdir, "sentences");
const refBases = existsSync(sentencesRoot)
  ? [...new Bun.Glob("*/*.json").scanSync(sentencesRoot)]
      .map((rel) => rel.match(/^([^/]+)[/](\d+)\.json$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => ({ category: m[1], id: Number.parseInt(m[2], 10) }))
      .sort((a, b) =>
        a.category === b.category
          ? a.id - b.id
          : a.category.localeCompare(b.category),
      )
  : [];
// Attach a per-file sentence `count` so the client can show per-category totals.
const refs = await Promise.all(
  refBases.map(async (ref) => {
    const arr = (await Bun.file(
      path.join(sentencesRoot, ref.category, `${ref.id}.json`),
    ).json()) as unknown[];
    return { ...ref, count: arr.length };
  }),
);
await mkdir(path.join(outdir, "sentences"), { recursive: true });
await writeFile(
  path.join(outdir, "sentences", "manifest.json"),
  JSON.stringify(refs),
);
console.log(`🗂️  Wrote sentences/manifest.json (${refs.length} files)`);

// 3. Disable Jekyll processing so files/folders are served verbatim.
await writeFile(path.join(outdir, ".nojekyll"), "");

// 4. Forbid machine access to the sentence JSON (crawlers, scrapers).
//    Copyright: all sentence text belongs to cafe6a6e; reproduction is prohibited.
await writeFile(
  path.join(outdir, "robots.txt"),
  ["User-agent: *", "Disallow: /sentences/", ""].join("\n"),
);
console.log("🤖 Wrote robots.txt (disallow /sentences/)");

const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms → ${outdir}\n`);
