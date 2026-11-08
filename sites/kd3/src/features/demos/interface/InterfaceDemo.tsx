
export function InterfaceDemo() {

  return (
    <article className="demo-card" id="interface">
      <div className="demo-header">
        <div>
          <h3>Edit the C++ call, see the result</h3>
        </div>
      </div>
      <p className="hint">
        Every query function is an editable kd3 call. Change the parameters,
        rebuild the tree, and watch the canvas and returned values update.
      </p>
      <div className="interface-toolbar">
        <label>
          function
          <select id="iface-fn">
            <option value="1nn">query_1nn</option>
            <option value="knn">query_knn</option>
            <option value="distance2">query_distance2</option>
            <option value="1nn_if">query_1nn_if</option>
            <option value="knn_if">query_knn_if</option>
            <option value="distance2_if">query_distance2_if</option>
            <option value="ray">query_ray</option>
            <option value="ray_distance">query_ray_distance</option>
          </select>
        </label>
        <label>
          points
          <select id="iface-count">
            <option value="120">120</option>
            <option value="260" selected>260</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
          </select>
        </label>
        <button id="iface-build" type="button">
          Rebuild tree
        </button>
        <button id="iface-run" type="button">
          Run query
        </button>
        <label className="check">
          <span className="check-spacer" aria-hidden="true" />
          <span className="check-control">
            <input id="iface-leaves" type="checkbox" checked />
            show leaf bounds
          </span>
        </label>
      </div>

      <p id="iface-status" className="demo-loading">
        Loading demo...
      </p>

      <div className="interface-layout">
        <div className="interface-left">
          <div
            id="iface-code"
            className="code-editor"
            aria-label="C++ invocation with editable parameters"
          />
          <div id="iface-legend" className="iface-legend" />
          <div
            id="iface-result"
            className="code-block compact result-block"
            aria-live="polite"
          />
          <div className="iface-stats">
            <span>
              points <strong id="iface-points">n/a</strong>
            </span>
            <span>
              leaves <strong id="iface-leaf-count">n/a</strong>
            </span>
          </div>
        </div>
        <canvas id="iface-canvas" aria-label="live kd3 interface result" />
      </div>

      <p className="api-link">
        <a href="https://karurochori.github.io/kd3/">
          Doxygen API reference
        </a>
      </p>
    </article>
  );
}
