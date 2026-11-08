
export function CloudDemo() {

  return (
    <article className="demo-card">
      <div className="demo-header">
        <div>
          <h3>Move a query through a trefoil cloud</h3>
        </div>
      </div>
      <p id="status" className="demo-loading">
        Loading demo...
      </p>
      <div className="demo3d-layout">
        <canvas id="view" aria-label="kd3 nearest-neighbour point cloud demo" />
        <aside className="demo-controls">
          <label>
            x <span id="qx-value">0.40</span>
            <input
              id="qx"
              type="range"
              min="-1.6"
              max="1.6"
              step="0.01"
              value="0.40"
            />
          </label>
          <label>
            y <span id="qy-value">0.30</span>
            <input
              id="qy"
              type="range"
              min="-1.6"
              max="1.6"
              step="0.01"
              value="0.30"
            />
          </label>
          <label>
            z <span id="qz-value">0.30</span>
            <input
              id="qz"
              type="range"
              min="-1.6"
              max="1.6"
              step="0.01"
              value="0.30"
            />
          </label>
          <label>
            k <span id="k-value">1</span>
            <input
              id="k"
              type="range"
              min="1"
              max="16"
              step="1"
              value="1"
            />
          </label>
          <div className="mini-stats">
            <div>
              <span>points</span>
              <strong id="point-count">n/a</strong>
            </div>
            <div>
              <span>nearest</span>
              <strong id="nearest-id">n/a</strong>
            </div>
            <div>
              <span>distance</span>
              <strong id="nearest-distance">n/a</strong>
            </div>
          </div>
          <button id="reset-view" type="button">
            Reset camera
          </button>
          <label className="check">
            <input id="auto-rotate" type="checkbox" checked />
            auto-rotate
          </label>
        </aside>
      </div>
    </article>
  );
}
