export type BenchmarkRow = {
  dataset: string;
  source: string;
  distribution: string;
  test: string;
  config: string;
  n_points: number;
  n_queries: number;
  k: number;
  build_s: number;
  kd3_s: number;
  kd3_qps: number;
  nf_build_s: number;
  nf_s: number;
  nf_qps: number;
  kd3_ok: string;
  nf_ok: string;
};

export type Architecture = {
  id: string;
  name: string;
  note: string;
  rows: BenchmarkRow[];
};

export type BenchmarkData = {
  architectures: Architecture[];
};

export type PerfSummary = {
  architectures: Array<{ id: string; name: string }>;
  rows: Array<{
    test: string;
    distribution: string;
    config: string;
    values: Array<number | null>;
  }>;
  max_speedup: number;
};
