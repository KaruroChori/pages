# pages

Static websites for KaruroChori projects, built with Bun and `@kitajs/html`.

Each site is an independent workspace package. Shared components and build
tooling are workspace packages, and each site deploys to its own project's
GitHub Pages branch.

## Layout

```text
packages/ui/       shared TSX components, formatting helpers, base CSS
packages/build/    shared site build, preview, and deploy helpers
sites/kd3/         kd3 website
```

## Commands

```sh
bun install

bun run build:kd3
bun run check:kd3
bun run serve:kd3
bun run deploy:kd3
```

`deploy:kd3` builds the kd3 site and publishes `sites/kd3/dist` to
`git@github.com:KaruroChori/kd3.git`, branch `gh-pages`.

The other sites follow the same pattern:

```sh
bun run build:<site>
bun run check:<site>
bun run serve:<site>
bun run deploy:<site>
```

## Sites

Each site package has a `site.config.ts` with its brand, navigation, section
links, and deployment target:

```ts
export const site = {
  name: "kd3",
  title: "kd3",
  brand: { label: "kd3", href: "index.html", logo: "../assets/logo.svg" },
  links: [...],
  sections: [...],
  deploy: {
    repo: "git@github.com:KaruroChori/kd3.git",
    branch: "gh-pages",
  },
};
```

## kd3 dependency

`sites/kd3/vendor/kd3` is a submodule pinned to a kd3 release. It supplies the
library headers for the wasm demos and the benchmark CSVs for the site data.

Update it with:

```sh
bun run update:kd3
```

The kd3 GitHub repository must contain the pinned commit before the pages
repository can be cloned elsewhere. Until then, the local checkout works from
the existing submodule.
