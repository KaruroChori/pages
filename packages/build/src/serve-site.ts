export function serveSite({
  dir = "dist",
  port = 8000,
}: {
  dir?: string;
  port?: number;
} = {}) {
  const server = Bun.serve({
    port,
    routes: {
      "/*": { dir },
    },
  });

  console.log(`serving ${dir}/ on ${server.url}`);
  return server;
}
