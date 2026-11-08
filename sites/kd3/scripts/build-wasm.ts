import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const web = join(import.meta.dir, "..");
const native = join(web, "native");
const output = join(web, "public", "wasm");
const targets = ["kd3_web", "kd3_interface", "kd3_glsl"];

mkdirSync(output, { recursive: true });

await Bun.$`xmake f -P . -p wasm --toolchain=zigcc -m release -y`.cwd(native);
await Bun.$`xmake build -P . kd3_web kd3_interface kd3_glsl`.cwd(native);

function findOutput(target: string, directory: string): string | null {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findOutput(target, path);
      if (found) return found;
    } else if (entry.name === `${target}.wasm` || entry.name === `${target}.html`) {
      return path;
    }
  }

  return null;
}

for (const target of targets) {
  const source = findOutput(target, join(native, "build"));
  if (!source) {
    console.error(`error: ${target} wasm output not found`);
    process.exit(1);
  }

  const destination = join(output, `${target}.wasm`);
  copyFileSync(source, destination);
  console.log(`wrote public/wasm/${target}.wasm (${statSync(destination).size} bytes)`);
}
