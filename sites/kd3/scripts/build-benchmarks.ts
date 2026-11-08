import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = join(import.meta.dir, "..");
const KD3 = join(SITE, "vendor", "kd3");
const RESULTS = join(KD3, "assets", "results");
const DATA = join(SITE, "src", "data");

const ARCHITECTURES: Record<string, string> = {
  "5950X": "Ryzen 9 5950X",
  "9950X3D2": "Ryzen 9 9950X3D2",
  "Xeon6252": "Xeon Gold 6252",
};

const PERF_ROWS = [
  ["nn1", "bbox-volume", "aabb"],
  ["nn1", "on-cloud", "aabb"],
  ["knn", "bbox-volume", "aabb"],
  ["knn", "on-cloud", "aabb"],
] as const;

const TEST_LABELS: Record<string, string> = {
  nn1: "1-NN",
  knn: "10-NN",
};

const NUMERIC = new Set([
  "n_points",
  "n_queries",
  "k",
  "build_s",
  "kd3_s",
  "kd3_qps",
  "nf_build_s",
  "nf_s",
  "nf_qps",
]);

type Row = Record<string, string | number>;

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function parseRow(line: string, header: string[]): Row {
  const cells = line.split(",");
  const row: Row = {};
  for (let i = 0; i < header.length; i += 1) {
    const key = header[i]!;
    const value = cells[i] ?? "";
    row[key] = NUMERIC.has(key) && value !== "" ? Number(value) : value;
  }
  return row;
}

const architectures: Array<{
  id: string;
  name: string;
  note: string;
  rows: Row[];
}> = [];

for (const dir of readdirSync(RESULTS).sort()) {
  const csvPath = join(RESULTS, dir, "kd3_datasets_report.csv");
  let csv: string;
  try {
    csv = readFileSync(csvPath, "utf8");
  } catch {
    continue;
  }
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  if (!headerLine) continue;
  const header = headerLine.split(",");
  const rows = lines
    .map((line) => parseRow(line, header))
    .filter((row) => row.kd3_ok === "1" && row.nf_ok === "1");

  let note = "";
  try {
    note = readFileSync(join(RESULTS, dir, "README.md"), "utf8").trim();
  } catch {
    // optional
  }

  architectures.push({
    id: dir,
    name: ARCHITECTURES[dir] ?? dir,
    note,
    rows,
  });
}

const benchmarkPayload = { architectures };
writeFileSync(
  join(DATA, "benchmarks.json"),
  JSON.stringify(benchmarkPayload),
);

const perfRows = PERF_ROWS.map(([test, distribution, config]) => {
  const values = architectures.map((arch) => {
    const speedups = arch.rows
      .filter(
        (row) =>
          row.test === test &&
          row.distribution === distribution &&
          row.config === config,
      )
      .map((row) => Number(row.kd3_qps) / Number(row.nf_qps));
    return speedups.length ? median(speedups) : null;
  });
  return {
    test: TEST_LABELS[test] ?? test,
    distribution,
    config,
    values,
  };
});

const maxSpeedup = Math.max(
  1,
  ...perfRows.flatMap((row) =>
    row.values.filter((value): value is number => value !== null),
  ),
);

writeFileSync(
  join(DATA, "perf-summary.json"),
  JSON.stringify({
    architectures: architectures.map(({ id, name }) => ({ id, name })),
    rows: perfRows,
    max_speedup: maxSpeedup,
  }),
);

console.log(
  `wrote ${architectures.length} architectures, ${architectures.reduce(
    (sum, arch) => sum + arch.rows.length,
    0,
  )} result rows`,
);
