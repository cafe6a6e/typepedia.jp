import { serve } from "bun";
import { addScore, readRanking } from "@/server/ranking";
import { listSentenceFiles, serveSentenceFile } from "@/server/sentenceFiles";
import type { ScoreEntry } from "@/types";
import index from "./index.html";

const clamp01 = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};
const numOr0 = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

const server = serve({
  routes: {
    // Ranking API.
    "/api/ranking": {
      async GET() {
        const list = await readRanking();
        return Response.json(list.slice(0, 100));
      },
      async POST(req) {
        let body: Record<string, unknown>;
        try {
          body = (await req.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const score = Number(body.score);
        if (!Number.isFinite(score) || score < 0) {
          return new Response("Invalid score", { status: 400 });
        }
        const entry: ScoreEntry = {
          username:
            String(body.username ?? "")
              .trim()
              .slice(0, 24) || "anonymous",
          score: Math.round(score),
          cpm: numOr0(body.cpm),
          wpm: numOr0(body.wpm),
          accuracy: clamp01(body.accuracy),
          ts: Date.now(),
        };
        const list = await addScore(entry);
        return Response.json(list.slice(0, 100));
      },
    },

    // Static-compatible manifest: same shape the built site serves from
    // docs/sentences/manifest.json. The client fetches this in both dev & prod.
    "/sentences/manifest.json": {
      GET() {
        return Response.json(listSentenceFiles());
      },
    },

    // Legacy/alias listing endpoint (kept for convenience).
    "/api/sentences": {
      GET() {
        return Response.json(listSentenceFiles());
      },
    },

    // Serve a sentence file (e.g. /sentences/eiken_1st_grade/1.json).
    "/sentences/:category/:file": (req) =>
      serveSentenceFile(req.params.category, req.params.file),

    // Serve index.html for all unmatched routes (SPA fallback).
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Listening on ${server.url}`);
