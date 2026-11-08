import benchmarks from "../../data/benchmarks.json";
import type { Architecture, BenchmarkData, BenchmarkRow } from "../../data/types";
import {
  formatCount,
  formatQps,
  formatSeconds,
  median,
} from "@pages/ui/format";
import { Layout } from "../../components/Layout";

const data = benchmarks as BenchmarkData;

const DATASET_ORDER = [
  "autzen",
  "bunny",
  "cities",
  "dragon",
  "synthetic-anisotropic",
  "synthetic-blobs",
  "synthetic-mixture",
  "synthetic-powerlaw",
  "synthetic-solid",
  "synthetic-sphere-shell",
  "synthetic-torus",
];

const CONFIG_ORDER = ["base", "aabb", "fast", "fast-aabb"];
const TEST_ORDER = ["nn1", "knn"];
const DISTRIBUTION_ORDER = ["bbox-volume", "on-cloud"];

const TEST_LABELS: Record<string, string> = { nn1: "1-NN", knn: "10-NN" };
const DISTRIBUTION_LABELS: Record<string, string> = {
  "bbox-volume": "bbox-volume",
  "on-cloud": "on-cloud",
};

function orderIndex(list: string[], value: string) {
  const index = list.indexOf(value);
  return index < 0 ? list.length : index;
}

function rowKey(row: BenchmarkRow) {
  return `${row.dataset}|${row.distribution}|${row.test}|${row.config}`;
}

function rowSort(a: BenchmarkRow, b: BenchmarkRow) {
  return (
    orderIndex(DATASET_ORDER, a.dataset) - orderIndex(DATASET_ORDER, b.dataset) ||
    orderIndex(DISTRIBUTION_ORDER, a.distribution) -
      orderIndex(DISTRIBUTION_ORDER, b.distribution) ||
    orderIndex(TEST_ORDER, a.test) - orderIndex(TEST_ORDER, b.test) ||
    orderIndex(CONFIG_ORDER, a.config) - orderIndex(CONFIG_ORDER, b.config)
  );
}

function speedup(row: BenchmarkRow | undefined) {
  return row ? row.kd3_qps / row.nf_qps : Number.NaN;
}

function speedClass(value: number) {
  if (!Number.isFinite(value)) return "missing";
  return value >= 1 ? "win" : "loss";
}

function barWidth(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(1, Math.min(100, (value / max) * 100));
}

function Cell({ row, max }: { row: BenchmarkRow | undefined; max: number }) {
  if (!row) return <td className="matrix-missing">n/a</td>;
  const value = speedup(row);
  return (
    <td>
      <div className={`matrix-cell ${speedClass(value)}`}>
        <div className="bench-cell-bars">
          <div className="bench-bar-row compact">
            <span>kd3</span>
            <div className="bench-track">
              <i className="kd3" style={{ width: `${barWidth(row.kd3_qps, max)}%` }} />
            </div>
            <strong>{formatQps(row.kd3_qps)}</strong>
          </div>
          <div className="bench-bar-row compact">
            <span>nanoflann</span>
            <div className="bench-track">
              <i className="nf" style={{ width: `${barWidth(row.nf_qps, max)}%` }} />
            </div>
            <strong>{formatQps(row.nf_qps)}</strong>
          </div>
        </div>
        <div className="matrix-meta">
          <strong className={speedClass(value)}>{value.toFixed(2)}x</strong>
          <span>
            build {formatSeconds(row.build_s)} / {formatSeconds(row.nf_build_s)}
          </span>
        </div>
      </div>
    </td>
  );
}

function DatasetTable({
  dataset,
  rows,
  architectures,
}: {
  dataset: string;
  rows: BenchmarkRow[];
  architectures: Architecture[];
}) {
  const maps = architectures.map((arch) => ({
    arch,
    map: new Map(
      arch.rows
        .filter((row) => row.dataset === dataset)
        .map((row) => [rowKey(row), row]),
    ),
  }));

  return (
    <section className="bench-dataset">
      <header className="bench-dataset-head">
        <h2>{dataset}</h2>
        <p>
          {formatCount(rows[0]?.n_points ?? 0)} points ·{" "}
          {formatCount(rows[0]?.n_queries ?? 0)} queries per run
        </p>
      </header>
      <div className="bench-table-wrap">
        <table className="bench-table matrix-table">
          <thead>
            <tr>
              <th>queries</th>
              <th>search</th>
              <th>config</th>
              <th>points</th>
              {maps.map(({ arch }) => (
                <th key={arch.id}>
                  <span>{arch.name}</span>
                  <small>kd3 vs nanoflann</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].sort(rowSort).map((row) => {
              const matches = maps.map(({ map }) => map.get(rowKey(row)));
              const max = Math.max(
                1,
                ...matches.flatMap((match) =>
                  match ? [match.kd3_qps, match.nf_qps] : [],
                ),
              );
              return (
                <tr key={rowKey(row)}>
                  <td>{DISTRIBUTION_LABELS[row.distribution] ?? row.distribution}</td>
                  <td>{TEST_LABELS[row.test] ?? row.test}</td>
                  <td>
                    <code>{row.config}</code>
                  </td>
                  <td>{formatCount(row.n_points)}</td>
                  {matches.map((match, index) => (
                    <Cell key={maps[index]!.arch.id} row={match} max={max} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryTable({ architectures }: { architectures: Architecture[] }) {
  const groups = new Map<
    string,
    {
      distribution: string;
      test: string;
      config: string;
      arch: Map<string, number[]>;
    }
  >();

  for (const arch of architectures) {
    for (const row of arch.rows) {
      const key = `${row.distribution}|${row.test}|${row.config}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          distribution: row.distribution,
          test: row.test,
          config: row.config,
          arch: new Map(),
        };
        groups.set(key, group);
      }
      const values = group.arch.get(arch.id) ?? [];
      values.push(speedup(row));
      group.arch.set(arch.id, values);
    }
  }

  const sorted = [...groups.values()].sort(
    (a, b) =>
      orderIndex(DISTRIBUTION_ORDER, a.distribution) -
        orderIndex(DISTRIBUTION_ORDER, b.distribution) ||
      orderIndex(TEST_ORDER, a.test) - orderIndex(TEST_ORDER, b.test) ||
      orderIndex(CONFIG_ORDER, a.config) - orderIndex(CONFIG_ORDER, b.config),
  );

  return (
    <section className="bench-overview">
      <header className="bench-overview-head">
        <h2>Median speedup by operation and configuration</h2>
        <p>
          Each value is the median across the 11 datasets for the same query
          pattern, search type, and configuration.
        </p>
      </header>
      <div className="bench-table-wrap">
        <table className="bench-table summary-table">
          <thead>
            <tr>
              <th>queries</th>
              <th>search</th>
              <th>config</th>
              {architectures.map((arch) => (
                <th key={arch.id}>{arch.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((group) => (
              <tr key={`${group.distribution}-${group.test}-${group.config}`}>
                <td>{DISTRIBUTION_LABELS[group.distribution] ?? group.distribution}</td>
                <td>{TEST_LABELS[group.test] ?? group.test}</td>
                <td>
                  <code>{group.config}</code>
                </td>
                {architectures.map((arch) => {
                  const values = group.arch.get(arch.id) ?? [];
                  const value = median(values);
                  const wins = values.filter((entry) => entry >= 1).length;
                  return (
                    <td key={arch.id}>
                      <div className={`summary-value ${speedClass(value)}`}>
                        <strong>
                          {Number.isFinite(value) ? `${value.toFixed(2)}x` : "n/a"}
                        </strong>
                        <span>
                          {wins}/{values.length} datasets faster
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BenchmarksPage() {
  const architectures = data.architectures;
  const allRows = architectures.flatMap((arch) => arch.rows);
  const datasets = [...new Set(allRows.map((row) => row.dataset))].sort(
    (a, b) =>
      orderIndex(DATASET_ORDER, a) - orderIndex(DATASET_ORDER, b) ||
      a.localeCompare(b),
  );

  const representative = new Map<string, BenchmarkRow>();
  for (const arch of architectures) {
    for (const row of arch.rows) {
      if (!representative.has(rowKey(row))) representative.set(rowKey(row), row);
    }
  }

  return (
    <Layout current="benchmarks">
      <main className="section">
        <header className="section-head">
          <h1 className="page-title">Benchmarks</h1>
          <p>
            Every measured result is listed below, grouped by dataset. Each row
            is a workload, and each architecture cell shows kd3 and nanoflann
            throughput as bars, the kd3 speedup, and both build times.
          </p>
        </header>

        <p className="bench-attribution">
          Baseline:{" "}
          <a href="https://github.com/jlblancoc/nanoflann">nanoflann</a>{" "}
          (BSD-2-Clause) by Jose Luis Blanco-Claraco and Pranav Kumar Rai.{" "}
          <a href="https://arxiv.org/abs/2610.15215">Paper</a>.
        </p>

        <p className="bench-notes">
          Machines: Ryzen 9 5950X (noisy baseline, dual-channel 3200 MT/s);
          Ryzen 9 9950X3D2 (87 W profile, dual-channel 5600 MT/s); Xeon Gold
          6252 (pinned, 2666 MT/s, four populated channels).
        </p>

        <p className="bench-notes">
          <code>bbox-volume</code> samples uniformly inside the cloud bounding
          box; <code>on-cloud</code> samples points close to the cloud with about
          0.2% jitter. Configurations: <code>base</code> (full query, basic
          split), <code>aabb</code> (full query, bboxes), <code>fast</code>{" "}
          (payload-free nodes, basic split), <code>fast-aabb</code>{" "}
          (payload-free nodes, bboxes). Bars compare kd3 and nanoflann; the line
          below gives the speedup and both build times.
        </p>

        <SummaryTable architectures={architectures} />
        <div className="bench-sections">
          {datasets.map((dataset) => {
            const rows = [...representative.values()].filter(
              (row) => row.dataset === dataset,
            );
            return (
              <DatasetTable
                key={dataset}
                dataset={dataset}
                rows={rows}
                architectures={architectures}
              />
            );
          })}
        </div>
      </main>
    </Layout>
  );
}

