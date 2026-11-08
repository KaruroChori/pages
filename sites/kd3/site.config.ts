import type { SectionLink } from "@pages/ui/SectionNav";
import type { Brand, NavLink } from "@pages/ui/TopNav";

export const site = {
  name: "kd3",
  title: "kd3",
  brand: {
    label: "kd3",
    href: "index.html",
    logo: "../assets/logo.svg",
  } satisfies Brand,
  links: [
    { id: "overview", href: "index.html", label: "Overview" },
    { id: "benchmarks", href: "benchmarks.html", label: "Benchmarks" },
    { id: "compare", href: "compare.html", label: "Compare" },
    { id: "code", href: "https://github.com/KaruroChori/kd3", label: "Get code" },
  ] satisfies NavLink[],
  sections: [
    { href: "#benchmarks", label: "Performance" },
    { href: "#compare", label: "Comparison summary" },
    { href: "#demos", label: "Demos" },
    { href: "#glsl", label: "GLSL raytracing" },
    { href: "#internals", label: "Internals" },
    { href: "#interface", label: "C++ interface" },
    { href: "#interfaces", label: "Build and use" },
    { href: "#family", label: "Family" },
    { href: "#licence", label: "Licence" },
  ] satisfies SectionLink[],
  deploy: {
    repo: "git@github.com:KaruroChori/kd3.git",
    branch: "gh-pages",
  },
};
