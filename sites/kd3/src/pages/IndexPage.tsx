import { Layout } from "../components/Layout";
import { PerformanceSummary } from "../features/benchmarks/PerformanceSummary";
import { Internals } from "../features/content/Internals";
import { Using } from "../features/content/Using";
import { CloudDemo } from "../features/demos/cloud/CloudDemo";
import { GlslDemo } from "../features/demos/glsl/GlslDemo";
import { InterfaceDemo } from "../features/demos/interface/InterfaceDemo";

export function IndexPage() {
  return (
    <Layout current="overview" sections>
      <header className="hero" id="top">
        <h1>kd3</h1>
        <p className="subtitle">
          Embeddable &amp; offloadable. High-performance static kd-trees.
        </p>
        <p className="lede">
          kd3 indexes points for nearest-neighbour queries, k-NN, rays, and
          predicate-filtered searches. Construction runs in parallel, queries
          use bounded stack space and caller-provided buffers, and the payload
          is application-defined.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#demos">
            Try the demos
          </a>
          <a className="button" href="benchmarks.html">
            See benchmarks
          </a>
        </div>
      </header>

      <section className="feature-strip">
        <article>
          <strong>Embedded first</strong>
          <p>
            No exceptions, no RTTI, bounded query stack, and no allocation
            during queries.
          </p>
        </article>
        <article>
          <strong>Parallel construction</strong>
          <p>OpenMP task-based building for large point sets.</p>
        </article>
        <article>
          <strong>Low-dimensional</strong>
          <p>Designed for 2D to 4D keys, with support for higher dimensions.</p>
        </article>
        <article>
          <strong>Header-only</strong>
          <p>
            Drop <code>include/kd3/</code> into your project. No required
            runtime.
          </p>
        </article>
        <article>
          <strong>C interface</strong>
          <p>A stb-style C wrapper for FFI and non-C++ callers.</p>
        </article>
        <article>
          <strong>GLSL generator</strong>
          <p>Generate shader query functions for the 2D to 4D tree layouts.</p>
        </article>
      </section>

      <section id="benchmarks" className="section">
        <header className="section-head">
          <h2>Performance</h2>
          <p>
            kd3 is generally faster than{" "}
            <a href="https://github.com/jlblancoc/nanoflann">nanoflann</a>{" "}
            across the tested point clouds and query patterns, particularly
            with subtree bounds and near-surface queries. Construction is
            parallel.
          </p>
        </header>
        <div className="bench-summary">
          <PerformanceSummary />
          <p>
            Each value is the median across all 11 datasets for the same
            operation and configuration. These rows use the <code>aabb</code>{" "}
            configuration with subtree bounds. Results without subtree bounds
            are mixed and are listed on the benchmark page.
          </p>
        </div>
        <p className="api-link">
          <a className="button primary" href="benchmarks.html">
            Full benchmark results
          </a>
        </p>
      </section>

      <section id="compare" className="section">
        <header className="section-head">
          <h2>Comparison with nanoflann</h2>
          <p>
            kd3 targets static low-dimensional point clouds. nanoflann covers a
            broader feature set. The full matrix is on the comparison page.
          </p>
        </header>

        <div className="compare-strengths">
          <div>
            <h3>kd3 is stronger for</h3>
            <ul>
              <li>Static 2D-4D clouds, near-data queries, and AABB pruning.</li>
              <li>Built-in filtered, ray, and cylinder queries.</li>
              <li>Caller-owned k-NN buffers and a trivially copyable view.</li>
              <li>C API, GLSL generator, and header-only C++23.</li>
            </ul>
          </div>
          <div>
            <h3>nanoflann is stronger for</h3>
            <ul>
              <li>Radius, approximate, and custom-metric search.</li>
              <li>Dynamic, incremental, and runtime-dimensional indexes.</li>
              <li>Non-owning adaptors and built-in index serialization.</li>
              <li>C++11, no OpenMP requirement, and a permissive licence.</li>
            </ul>
          </div>
        </div>

        <p className="api-link">
          <a className="button primary" href="compare.html">
            Full comparison matrix
          </a>
        </p>
      </section>

      <section id="demos" className="section">
        <header className="section-head">
          <h2>Query the tree in the browser</h2>
          <p>
            The first demo runs editable kd3 queries against a rebuilt tree.
            The second queries a 3D point cloud.
          </p>
        </header>
        <div className="demo-stack">
          <InterfaceDemo />
          <CloudDemo />
        </div>
      </section>

      <section id="glsl" className="section">
        <header className="section-head">
          <h2>Raytrace the kd3 tree on the GPU</h2>
          <p>
            The tree is built in WebAssembly, its flat buffers are uploaded to
            the GPU, and a fragment shader generated by{" "}
            <code>kd3::generate_glsl</code> traces one ray per pixel. kd3 does
            not provide a shader backend for web use; this demo manually adapts
            the generated GLSL to WebGL2 texture storage for visualization
            only. It is not a supported web rendering path.
          </p>
        </header>
        <GlslDemo />
      </section>

      <Internals />
      <Using />

      <section id="family" className="section">
        <header className="section-head">
          <h2>Other spatial indexes from the same family</h2>
          <p>
            Separate libraries because their public interfaces cannot fully
            overlap, but the design principles and storage model are shared.
          </p>
        </header>
        <div className="family-grid">
          <a
            className="family-card"
            href="https://github.com/karurochori/bvh3"
          >
            <strong>bvh3</strong>
            <span>BVH</span>
            <p>Bounding volume hierarchy for ray and primitive queries.</p>
          </a>
          <a className="family-card" href="https://github.com/karurochori/oc3">
            <strong>oc3</strong>
            <span>octree</span>
            <p>Octree index for spatial subdivision and volume queries.</p>
          </a>
        </div>
      </section>

      <section id="licence" className="section">
        <header className="section-head">
          <h2>Licence</h2>
        </header>
        <div className="info-card">
          <p>
            kd3 is free software licensed under the GNU Affero General Public
            License, version 3 only (<code>AGPL-3.0-only</code>). A commercial
            licence is available on request.
          </p>
          <p>
            The full licence text is in the repository's <code>LICENCE.txt</code>{" "}
            file.{" "}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html">
              Read the AGPL-3.0 text
            </a>
            .
          </p>
        </div>
      </section>
    </Layout>
  );
}

