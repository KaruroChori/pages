import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document } from "@pages/ui/Document";

export type SitePage = {
  file: string;
  title: string;
  body: string;
  script?: string;
};

export type BuildSiteOptions = {
  pages: SitePage[];
  stylesheets: string[];
  assets?: string;
  publicDir?: string;
  outDir?: string;
};

function copyContents(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    cpSync(join(source, entry.name), join(destination, entry.name), {
      recursive: true,
    });
  }
}

export async function buildSite({
  pages,
  stylesheets,
  assets = "src/assets",
  publicDir = "public",
  outDir = "dist",
}: BuildSiteOptions) {
  const siteDir = process.cwd();
  const buildDir = join(siteDir, ".build");
  const pagesDir = join(buildDir, "pages");

  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(pagesDir, { recursive: true });

  if (assets) {
    const assetsDir = join(siteDir, assets);
    if (existsSync(assetsDir)) {
      copyContents(assetsDir, join(buildDir, "assets"));
    }
  }

  for (const page of pages) {
    const html = `<!doctype html>\n${Document({
      title: page.title,
      stylesheets,
      script: page.script,
      children: page.body,
    })}\n`;
    writeFileSync(join(pagesDir, page.file), html);
  }

  rmSync(outDir, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: pages.map((page) => join(pagesDir, page.file)),
    outdir: outDir,
    target: "browser",
    minify: true,
    splitting: true,
    sourcemap: "linked",
    naming: {
      entry: "[dir]/[name].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  if (publicDir) {
    const publicPath = join(siteDir, publicDir);
    if (existsSync(publicPath)) {
      copyContents(publicPath, outDir);
    }
  }

  console.log(`built ${outDir}/`);
}
