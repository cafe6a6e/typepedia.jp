import { serve } from "bun";
import { listSentenceFiles, serveSentenceFile } from "@/server/sentenceFiles";
import index from "./index.html";

const server = serve({
  routes: {
    // Sentence file manifest. Also generated statically at build time as
    // docs/sentences/manifest.json; the client fetches this in dev & prod.
    "/sentences/manifest.json": {
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
