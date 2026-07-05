# typepedia.jp
Learn Through Typing.


## Install


To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

## Deploy (GitHub Pages)

The `docs/` folder is published directly by GitHub Pages. To apply changes,
build and commit:

```bash
bun run build.ts
git add -A && git commit -m "Update site"
git push
```

The sentence data (`docs/sentences/<category>/<n>.json`) is the single source of
truth. `bun run build.ts` outputs the app into `docs/`, keeps `docs/sentences/`
intact, and regenerates `sentences/manifest.json` (the dev server reads from the
same `docs/sentences/`).

This project was created using `bun init` in bun v1.2.16. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
