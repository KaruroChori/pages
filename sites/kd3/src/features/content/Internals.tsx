export function Internals() {
  return (
<section id="internals" className="section">
    <header className="section-head">
      <h2>Balanced tree, flat storage, explicit queries</h2>
      <p>
        kd3 builds a balanced binary tree over fixed-size leaf buckets. The
        payload is application-defined.
      </p>
    </header>

    <div className="internals-grid">
      <article className="info-card">
        <h3>Split on the widest axis</h3>
        <p>
          The builder computes tight bounds for each subtree, splits along the
          widest axis at the median, and recurses until each leaf holds at most
          <code>leaf_size</code> points. Leaves are packed into fixed-size
          buckets; empty slots are padded with <code>INF</code> and
          <code>INF_IDX</code>.
        </p>
        <svg className="build-figure" viewBox="0 0 680 250" role="img"
             aria-label="A point cloud split by a median plane, then grouped into leaf buckets">
          <rect x="1" y="1" width="678" height="248" rx="14" fill="#0a111c" stroke="#1f3048"/>
          <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="#8296ad">
            <text x="24" y="26">points</text>
            <text x="248" y="26">median split</text>
            <text x="486" y="26">leaf buckets</text>
          </g>

          <rect x="20" y="40" width="184" height="180" rx="10" fill="#0d1624" stroke="#1f3048"/>
          <g fill="#4e9cff">
            <circle cx="60" cy="78" r="4"/><circle cx="88" cy="66" r="4"/>
            <circle cx="116" cy="92" r="4"/><circle cx="148" cy="74" r="4"/>
            <circle cx="74" cy="116" r="4"/><circle cx="106" cy="138" r="4"/>
            <circle cx="142" cy="120" r="4"/><circle cx="166" cy="148" r="4"/>
            <circle cx="54" cy="166" r="4"/><circle cx="94" cy="186" r="4"/>
            <circle cx="132" cy="178" r="4"/><circle cx="170" cy="196" r="4"/>
          </g>

          <rect x="244" y="40" width="184" height="180" rx="10" fill="#0d1624" stroke="#1f3048"/>
          <line x1="336" y1="40" x2="336" y2="220" stroke="#ffb454" stroke-dasharray="5 5"/>
          <g fill="#4e9cff">
            <circle cx="266" cy="78" r="4"/><circle cx="294" cy="64" r="4"/>
            <circle cx="314" cy="96" r="4"/><circle cx="276" cy="122" r="4"/>
            <circle cx="306" cy="144" r="4"/><circle cx="258" cy="170" r="4"/>
            <circle cx="296" cy="190" r="4"/><circle cx="322" cy="174" r="4"/>
          </g>
          <g fill="#ffb454">
            <circle cx="356" cy="70" r="4"/><circle cx="390" cy="88" r="4"/>
            <circle cx="410" cy="62" r="4"/><circle cx="366" cy="118" r="4"/>
            <circle cx="402" cy="136" r="4"/><circle cx="352" cy="164" r="4"/>
            <circle cx="386" cy="186" r="4"/><circle cx="414" cy="176" r="4"/>
          </g>

          <rect x="468" y="40" width="192" height="82" rx="10" fill="#0d1624" stroke="#1f3048"/>
          <rect x="468" y="138" width="192" height="82" rx="10" fill="#0d1624" stroke="#1f3048"/>
          <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" fill="#4e9cff">
            <text x="480" y="58">bucket 0 | left half</text>
            <circle cx="488" cy="82" r="3"/><circle cx="514" cy="78" r="3"/>
            <circle cx="542" cy="92" r="3"/><circle cx="568" cy="74" r="3"/>
            <circle cx="596" cy="88" r="3"/><circle cx="626" cy="78" r="3"/>
          </g>
          <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" fill="#ffb454">
            <text x="480" y="156">bucket 1 | right half</text>
            <circle cx="488" cy="180" r="3"/><circle cx="514" cy="176" r="3"/>
            <circle cx="542" cy="190" r="3"/><circle cx="568" cy="174" r="3"/>
            <circle cx="596" cy="188" r="3"/><circle cx="626" cy="178" r="3"/>
          </g>
        </svg>
        <p className="caption">
          Each split removes half the remaining points from consideration. The
          leaves are the only place where full point coordinates are stored.
        </p>
      </article>

      <article className="info-card">
        <h3>Four flat arrays</h3>
        <p>
          For <code>N = 7000</code>, <code>leaf_size = 8</code>, and
          <code>D = 3</code>, the tree has <code>B = 875</code> leaf buckets.
          The owning <code>KdTree</code> holds four contiguous arrays; the
          non-owning <code>KdTreeView</code> is just spans into them plus the
          root bounds.
        </p>

        <div className="memory-bar" aria-label="Approximate memory layout">
          <div className="mem-seg mem-vals" style={{ flex: 3 }}>vals <span>3.5 KB</span></div>
          <div className="mem-seg mem-dims" style={{ flex: 1 }}>dims <span>224 B</span></div>
          <div className="mem-seg mem-buckets" style={{ flex: 68 }}>buckets <span>109 KB</span></div>
          <div className="mem-seg mem-boxes" style={{ flex: 28 }}>boxes <span>41 KB</span></div>
        </div>

        <table className="mem-table">
          <thead>
            <tr><th>array</th><th>content</th><th>size</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>split_vals</code></td>
              <td>split coordinate per internal node</td>
              <td><code>B-1</code> scalars</td>
            </tr>
            <tr>
              <td><code>split_dims</code></td>
              <td>packed axis ids</td>
              <td>bit-packed words</td>
            </tr>
            <tr>
              <td><code>buckets</code></td>
              <td><code>coords[D][leaf_size]</code> + <code>ids[leaf_size]</code></td>
              <td><code>B</code> x bucket</td>
            </tr>
            <tr>
              <td><code>node_boxes</code></td>
              <td>optional tight AABB per subtree</td>
              <td><code>2B-1</code> boxes</td>
            </tr>
          </tbody>
        </table>

        <div className="bucket-detail">
          <div className="bucket-title">one <code>LeafBucket</code> | 8 slots</div>
          <div className="bucket-slots">
            <div><span>slot 0</span><small>id 12</small></div>
            <div><span>slot 1</span><small>id 4</small></div>
            <div><span>slot 2</span><small>id 27</small></div>
            <div><span>slot 3</span><small>id 8</small></div>
            <div><span>slot 4</span><small>id 19</small></div>
            <div><span>slot 5</span><small>id 2</small></div>
            <div className="pad"><span>INF</span><small>INF_IDX</small></div>
            <div className="pad"><span>INF</span><small>INF_IDX</small></div>
          </div>
          <p>Slots hold coordinates and a payload ID. Empty slots use INF coordinates and the INF_IDX payload sentinel.</p>
        </div>
      </article>
    </div>

  </section>
  );
}
