import { Layout } from "../../components/Layout";
import { Hint } from "@pages/ui/Hint";

type Status = "yes" | "no" | "partial" | "neutral" | "good" | "bad";

type Cell = {
  text: string;
  status?: Status;
  tip?: string;
};

type Row = {
  capability: string;
  kd3: Cell;
  nano: Cell;
};

type Group = { group: string } | Row;

const rows: Group[] = [
  { group: "Index and search" },
  { capability: "Static kd-tree", kd3: { text: "Yes", status: "yes" }, nano: { text: "Yes", status: "yes" } },
  { capability: "Dynamic add/remove", kd3: { text: "No", status: "no", tip: "Static by design. A small mutable wrapper around KdTreeView (see examples/mutable) adds insert/erase/kNN without changing the core index." }, nano: { text: "Yes", status: "yes", tip: "KDTreeSingleIndexDynamicAdaptor" } },
  { capability: "Incremental / self-balancing tree", kd3: { text: "No", status: "no", tip: "Not built in. The same mutable wrapper can rebuild or maintain a delta tree; self-balancing is a wrapper policy, not a core feature." }, nano: { text: "Yes", status: "yes", tip: "KDTreeSingleIndexIncrementalAdaptor" } },
  { capability: "Async / multi-threaded incremental variant", kd3: { text: "No", status: "no", tip: "No built-in async index. A wrapper can rebuild a new tree in the background and swap the view." }, nano: { text: "Yes", status: "yes", tip: "KDTreeSingleIndexIncrementalAdaptorMT" } },
  { capability: "Compile-time dimensionality", kd3: { text: "Yes", status: "yes", tip: "limits<Scalar, Dims, ...>" }, nano: { text: "Yes", status: "yes", tip: "DIM > 0" } },
  { capability: "Runtime dimensionality", kd3: { text: "No", status: "no" }, nano: { text: "Yes", status: "yes", tip: "DIM = -1" } },
  { capability: "1-NN", kd3: { text: "Yes", status: "yes" }, nano: { text: "Yes", status: "yes" } },
  { capability: "k-NN", kd3: { text: "Yes", status: "yes" }, nano: { text: "Yes", status: "yes" } },
  { capability: "Radius search", kd3: { text: "No", status: "no" }, nano: { text: "Yes", status: "yes", tip: "radiusSearch()" } },
  { capability: "Radius-limited k-NN", kd3: { text: "No", status: "no" }, nano: { text: "Yes", status: "yes", tip: "rknnSearch()" } },
  { capability: "Approximate search", kd3: { text: "No", status: "no", tip: "Exact search only" }, nano: { text: "Yes", status: "yes", tip: "SearchParameters::eps" } },
  { capability: "Custom result set", kd3: { text: "No", status: "no" }, nano: { text: "Yes", status: "yes", tip: "Templated RESULTSET" } },
  { capability: "Custom distance metric", kd3: { text: "No", status: "no", tip: "Squared L2 only" }, nano: { text: "Yes", status: "yes", tip: "L1, L2, L2_Simple, SO2, SO3, and custom metrics" } },
  { capability: "Filtered queries", kd3: { text: "Yes", status: "yes", tip: "Built-in _if variants" }, nano: { text: "Partial", status: "partial", tip: "Possible via a custom result set or adaptor; not a first-class predicate API" } },
  { capability: "Ray / cylinder query", kd3: { text: "Yes", status: "yes" }, nano: { text: "No", status: "no" } },
  { capability: "Tie-break control", kd3: { text: "No", status: "no", tip: "Unspecified" }, nano: { text: "Yes", status: "yes", tip: "NANOFLANN_FIRST_MATCH" } },
  { capability: "Parallel build", kd3: { text: "Yes", status: "yes", tip: "OpenMP tasks" }, nano: { text: "Limited", status: "partial", tip: "std::async with n_thread_build, but a global lock limits scalability" } },
  { capability: "Index serialization", kd3: { text: "Buffer copy", status: "neutral", tip: "No built-in API; the flat tree storage is a set of buffers that can be copied or memory-mapped" }, nano: { text: "Yes", status: "yes", tip: "saveIndex() and loadIndex()" } },
  { capability: "Query-time allocation", kd3: { text: "None", status: "yes" }, nano: { text: "DIM-dependent", status: "neutral", tip: "Fixed DIM: stack or array; runtime DIM: std::vector" } },

  { group: "Data, layout, and API" },
  { capability: "Data ownership", kd3: { text: "Owning", status: "neutral", tip: "Owning tree copies points into SoA leaves" }, nano: { text: "Non-owning", status: "neutral", tip: "Non-owning index over a dataset adaptor" } },
  { capability: "Mutates input during build", kd3: { text: "Yes", status: "neutral", tip: "Input is sorted" }, nano: { text: "No", status: "neutral" } },
  { capability: "Arbitrary data source / adaptor", kd3: { text: "No", status: "no", tip: "Requires a FatPoint array" }, nano: { text: "Yes", status: "yes", tip: "Any adaptor, including an Eigen matrix adaptor" } },
  { capability: "SoA leaf layout", kd3: { text: "Yes", status: "yes" }, nano: { text: "No", status: "no" } },
  { capability: "Hand-written SIMD kernels", kd3: { text: "Opt-in", status: "yes", tip: "Opt-in AVX2/AVX-512; fixed-point kernels" }, nano: { text: "No", status: "no", tip: "Compiler or adaptor dependent" } },
  { capability: "Per-subtree AABB toggle", kd3: { text: "Yes", status: "yes", tip: "has_aabb" }, nano: { text: "No", status: "no", tip: "Dataset bbox adaptor plus split-plane pruning; no equivalent toggle" } },
  { capability: "Trivially copyable query view", kd3: { text: "Yes", status: "yes", tip: "KdTreeView" }, nano: { text: "No", status: "no", tip: "The index object is not offload-oriented" } },
  { capability: "Built-in C API", kd3: { text: "Yes", status: "yes", tip: "STB-style C wrapper" }, nano: { text: "No", status: "no" } },
  { capability: "GLSL / shader generator", kd3: { text: "Yes", status: "yes", tip: "Experimental" }, nano: { text: "No", status: "no" } },
  { capability: "Header-only", kd3: { text: "Yes", status: "yes" }, nano: { text: "Yes", status: "yes" } },
  { capability: "Required C++ standard", kd3: { text: "C++23" }, nano: { text: "C++11" } },
  { capability: "OpenMP required", kd3: { text: "Build-time", status: "bad", tip: "Build uses OpenMP or an omp-stub" }, nano: { text: "No", status: "good" } },
  { capability: "Licence", kd3: { text: "AGPL-3.0-only or commercial", tip: "Commercial licence available on request" }, nano: { text: "BSD-2-Clause" } },
  { capability: "Primary tuning target", kd3: { text: "Static low-D", status: "neutral", tip: "Static low-dimensional point clouds, near-data/AABB queries, SoA SIMD" }, nano: { text: "General-purpose", status: "neutral", tip: "General-purpose kd-tree flexibility" } },
];

function StatusCell({ cell }: { cell: Cell }) {
  return (
    <td>
      {cell.status ? (
        <span className={`status ${cell.status}`}>{cell.text}</span>
      ) : (
        cell.text
      )}
      {cell.tip ? <Hint tip={cell.tip} /> : null}
    </td>
  );
}

export function ComparePage() {
  return (
    <Layout current="compare">
      <main className="section compare-page">
        <header className="section-head">
          <h1 className="page-title">Comparison</h1>
          <p>
            Feature comparison based on kd3 1.5.0 and nanoflann 1.10.0. kd3
            targets static low-dimensional clouds; nanoflann covers a broader
            feature set. Colors indicate advantage in this comparison, not
            simply whether a feature exists.
          </p>
        </header>

        <div className="compare-strengths">
          <div>
            <h2>kd3 is stronger for</h2>
            <ul>
              <li>Static 2D-4D point clouds, especially near-data queries.</li>
              <li>Volume and ray queries when subtree bounds are enabled.</li>
              <li>First-class filtered 1-NN, k-NN, and distance queries.</li>
              <li>Caller-owned k-NN buffers and a trivially copyable view.</li>
              <li>C API, GLSL generator, and header-only C++23.</li>
            </ul>
          </div>
          <div>
            <h2>nanoflann is stronger for</h2>
            <ul>
              <li>Radius, approximate, and custom-metric search.</li>
              <li>Dynamic, incremental, and runtime-dimensional indexes.</li>
              <li>Non-owning adaptors and built-in index serialization.</li>
              <li>C++11 compatibility and no OpenMP requirement.</li>
              <li>A permissive BSD licence and a mature ecosystem.</li>
            </ul>
          </div>
        </div>

        <div className="info-card compare-card">
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>kd3 1.5</th>
                  <th>nanoflann 1.10</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) =>
                  "group" in row ? (
                    <tr className="compare-group" key={`group-${row.group}`}>
                      <td colSpan={3}>{row.group}</td>
                    </tr>
                  ) : (
                    <tr key={`${row.capability}-${index}`}>
                      <td>{row.capability}</td>
                      <StatusCell cell={row.kd3} />
                      <StatusCell cell={row.nano} />
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            Performance is configuration-dependent. kd3 wins clearly on
            near-data queries and on volume queries with AABB enabled;
            nanoflann remains the broader library. nanoflann's parallel build
            is present, but a global lock limits scalability. The benchmark
            page lists every measured row.
          </p>
          <p className="compare-note">
            kd3 is a static index. The repository includes a small
            compaction-based mutable wrapper in{" "}
            <a href="https://github.com/KaruroChori/kd3/tree/master/examples/mutable">
              examples/mutable
            </a>{" "}
            with an optional delta tree and bulk creation. It adds
            insert/erase/kNN around <code>KdTreeView</code> without changing
            the core index. The{" "}
            <a href="https://github.com/KaruroChori/kd3/blob/master/benchmarks/mutable.comparative.cpp">
              mutable benchmark
            </a>{" "}
            validates it against nanoflann's dynamic adaptors. Dynamic support
            is not built in, but the wrapper is deliberately small.
          </p>
        </div>
      </main>
    </Layout>
  );
}
