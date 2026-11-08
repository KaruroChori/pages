export type DeploySiteOptions = {
  repo: string;
  branch?: string;
  dist?: string;
  message?: string;
};

export async function deploySite({
  repo,
  branch = "gh-pages",
  dist = "dist",
  message = `deploy ${new Date().toISOString()}`,
}: DeploySiteOptions) {
  const ghPages = Bun.fileURLToPath(
    import.meta.resolve("gh-pages/bin/gh-pages.js"),
  );

  console.log(`publishing ${dist}/ to ${repo}#${branch}...`);
  await Bun.$`bun ${ghPages} -d ${dist} -b ${branch} -r ${repo} --nojekyll -m ${message}`;
  console.log("published");
}
