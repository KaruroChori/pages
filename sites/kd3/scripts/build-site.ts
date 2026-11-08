import { buildSite } from "@pages/build";
import { BenchmarksPage } from "../src/features/benchmarks/BenchmarksPage";
import { ComparePage } from "../src/features/compare/ComparePage";
import { IndexPage } from "../src/pages/IndexPage";
import { site } from "../site.config";

await buildSite({
  pages: [
    {
      file: "index.html",
      title: site.title,
      body: IndexPage(),
      script: "../../src/pages/index.client.ts",
    },
    {
      file: "benchmarks.html",
      title: `${site.title} | benchmarks`,
      body: BenchmarksPage(),
    },
    {
      file: "compare.html",
      title: `${site.title} | comparison`,
      body: ComparePage(),
      script: "../../src/pages/compare.client.ts",
    },
  ],
  stylesheets: ["../../src/styles/kd3.css"],
  assets: "src/assets",
  publicDir: "public",
});
