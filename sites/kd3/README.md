# kd3 site

Bun + TypeScript + @kitajs/html static site for kd3.

Build and deploy from the repository root:

```sh
bun run build:kd3
bun run check:kd3
bun run serve:kd3     # http://localhost:8000/
bun run deploy:kd3    # publish to the kd3 gh-pages branch
```

The site deploys to `git@github.com:KaruroChori/kd3.git`, branch `gh-pages`.
Configure that repository with **Deploy from a branch**, branch `gh-pages`,
folder `/ (root)`.

## Layout

```text
src/pages/       page components and client entrypoints
src/features/    benchmarks, comparison, demos
src/data/        generated benchmark JSON
src/styles/      kd3 styles
native/          C++ wasm demos and xmake build
vendor/kd3/      kd3 submodule pinned to a release
.build/          generated HTML entrypoints (ignored)
public/          wasm assets copied into dist/
```

The shared layout, navigation, hints, code blocks, and base styles live in
`packages/ui` at the repository root. The build and deploy helpers live in
`packages/build`.

Pages are rendered to static HTML with `@kitajs/html`. Only the demos and
comparison hints have client entrypoints. Syntax highlighting uses Prism at
build time.

The C++ demos are not ported to JavaScript. They are built with xmake and
zigcc, then copied into `public/wasm/`.

The GLSL demo uses a kd3 tree built in WebAssembly, the WebGL2 texture
adapter for the generated GLSL, and direct ray queries. kd3 does not provide a
WebGL shader backend; this is visualization-only and not a supported web
rendering path.
