// @ts-nocheck
export async function mountInterfaceDemo() {
const canvas = document.getElementById("iface-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const fnSelect = document.getElementById("iface-fn");
const countSelect = document.getElementById("iface-count");
const buildButton = document.getElementById("iface-build");
const runButton = document.getElementById("iface-run");
const leavesToggle = document.getElementById("iface-leaves");
const statusEl = document.getElementById("iface-status");
const codeEl = document.getElementById("iface-code");
const legendEl = document.getElementById("iface-legend");
const resultEl = document.getElementById("iface-result");
const pointsEl = document.getElementById("iface-points");
const leavesEl = document.getElementById("iface-leaf-count");
const fatalEl = document.getElementById("fatal");

let wasm = null;
let points = null;
let leafBoxes = null;
let pointCount = 0;
let leafCount = 0;
let knnIds = [];
let knnDist2 = [];
const view = { size: 1, pad: 28, scale: 1, dpr: 1 };

const params = {
  x: 0.5,
  y: 0.5,
  k: 4,
  filter: 1,
  ox: 0.08,
  oy: 0.08,
  dx: 0.707,
  dy: 0.707,
  maxT: 1.5,
  radius: 0.01,
};

function makeWasi() {
  return {
    fd_seek: () => 0,
    fd_write: () => 0,
    fd_close: () => 0,
    proc_exit: (code) => {
      throw new Error(`wasm exited with code ${code}`);
    },
  };
}

function format(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function numInput(param, step, min, max, width = 6) {
  const value = param === "k" ? String(params[param]) : format(params[param], 3);
  return `<input class="code-input" data-param="${param}" type="number" step="${step}" min="${min}" max="${max}" value="${value}" style="width:${width}ch">`;
}

function filterSelect() {
  return (
    `<select class="code-select" data-param="filter">` +
    `<option value="1"${params.filter === 1 ? " selected" : ""}>id % 2 == 0</option>` +
    `<option value="2"${params.filter === 2 ? " selected" : ""}>point.x > 0.5</option>` +
    `<option value="3"${params.filter === 3 ? " selected" : ""}>id % 3 != 0</option>` +
    `</select>`
  );
}

function renderLegend() {
  const mode = fnSelect.value;
  let items = [];
  if (mode === "knn" || mode === "knn_if") {
    items.push(["k", "number of neighbours"]);
    items.push(["x, y", "query point in [0, 1]"]);
  } else if (mode.startsWith("ray")) {
    items.push(["ox, oy", "ray origin in [0, 1]"]);
    items.push(["dx, dy", "ray direction"]);
    items.push(["max_t", "maximum ray parameter"]);
    items.push(["radius", "cylinder radius, 0 for a line"]);
  } else {
    items.push(["x, y", "query point in [0, 1]"]);
  }
  if (mode.endsWith("_if")) {
    items.push(["filter", "predicate applied to payload ids"]);
  }
  legendEl.innerHTML = items
    .map(([name, text]) => `<div><code>${name}</code><span>${text}</span></div>`)
    .join("");
}

function renderCodeEditor() {
  const mode = fnSelect.value;
  const x = numInput("x", 0.001, 0, 1, 7);
  const y = numInput("y", 0.001, 0, 1, 7);
  const k = numInput("k", 1, 1, 16, 3);
  const ox = numInput("ox", 0.001, 0, 1, 7);
  const oy = numInput("oy", 0.001, 0, 1, 7);
  const dx = numInput("dx", 0.001, -1, 1, 7);
  const dy = numInput("dy", 0.001, -1, 1, 7);
  const maxT = numInput("maxT", 0.01, 0.1, 2, 6);
  const radius = numInput("radius", 0.001, 0, 0.05, 7);

  let lines;
  if (mode === "1nn") {
    lines = [
      `<span class="code-kw">auto</span> hit = tree.<span class="code-fn">query_1nn</span>({${x}f, ${y}f});`,
    ];
  } else if (mode === "knn") {
    lines = [
      `std::array&lt;Tree::KnnResult, ${k}&gt; buffer;`,
      `<span class="code-kw">auto</span> hits = tree.<span class="code-fn">query_knn</span>({${x}f, ${y}f}, buffer);`,
    ];
  } else if (mode === "distance2") {
    lines = [
      `<span class="code-kw">auto</span> dist2 = tree.<span class="code-fn">query_distance2</span>({${x}f, ${y}f});`,
    ];
  } else if (mode === "1nn_if") {
    lines = [
      `<span class="code-kw">auto</span> accept = [](std::uint32_t id, <span class="code-kw">const auto</span>&amp;) {`,
      `    <span class="code-kw">return</span> ${filterSelect()};`,
      `};`,
      `<span class="code-kw">auto</span> hit = tree.<span class="code-fn">query_1nn_if</span>({${x}f, ${y}f}, accept);`,
    ];
  } else if (mode === "knn_if") {
    lines = [
      `<span class="code-kw">auto</span> accept = [](std::uint32_t id, <span class="code-kw">const auto</span>&amp;) {`,
      `    <span class="code-kw">return</span> ${filterSelect()};`,
      `};`,
      `std::array&lt;Tree::KnnResult, ${k}&gt; buffer;`,
      `<span class="code-kw">auto</span> hits = tree.<span class="code-fn">query_knn_if</span>({${x}f, ${y}f}, buffer, accept);`,
    ];
  } else if (mode === "distance2_if") {
    lines = [
      `<span class="code-kw">auto</span> accept = [](std::uint32_t id, <span class="code-kw">const auto</span>&amp;) {`,
      `    <span class="code-kw">return</span> ${filterSelect()};`,
      `};`,
      `<span class="code-kw">auto</span> dist2 = tree.<span class="code-fn">query_distance2_if</span>({${x}f, ${y}f}, accept);`,
    ];
  } else if (mode === "ray") {
    lines = [
      `<span class="code-kw">auto</span> hit = tree.<span class="code-fn">query_ray</span>(`,
      `    {${ox}f, ${oy}f}, {${dx}f, ${dy}f},`,
      `    ${maxT}f, ${radius}f);`,
    ];
  } else {
    lines = [
      `<span class="code-kw">auto</span> t = tree.<span class="code-fn">query_ray_distance</span>(`,
      `    {${ox}f, ${oy}f}, {${dx}f, ${dy}f},`,
      `    ${maxT}f, ${radius}f);`,
    ];
  }

  codeEl.innerHTML = lines.map((line) => `<div class="code-line">${line}</div>`).join("");
  syncInputs();
  renderLegend();
}

function syncInputs() {
  for (const input of codeEl.querySelectorAll("[data-param]")) {
    if (document.activeElement === input) continue;
    const param = input.dataset.param;
    if (param === "filter") input.value = String(params.filter);
    else if (param === "k") input.value = String(params.k);
    else input.value = format(params[param], 3);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.dpr = dpr;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.size = Math.min(rect.width, rect.height);
  view.pad = view.size * 0.07;
  view.scale = view.size - view.pad * 2;
  draw();
}

function toScreen(x, y) {
  return {
    x: view.pad + x * view.scale,
    y: view.pad + (1 - y) * view.scale,
  };
}

function fromScreen(x, y) {
  return {
    x: Math.max(0, Math.min(1, (x - view.pad) / view.scale)),
    y: Math.max(0, Math.min(1, 1 - (y - view.pad) / view.scale)),
  };
}

function isRayMode() {
  return fnSelect.value.startsWith("ray");
}

function resultRows(rows) {
  return (
    `<div class="result-title">returned</div>` +
    `<div class="result-grid">` +
    rows
      .map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`)
      .join("") +
    `</div>`
  );
}

function resultList(title, rows) {
  return (
    `<div class="result-title">${title}</div>` +
    `<div class="result-list">` +
    rows
      .map(
        (row, index) =>
          `<div><span>[${index}]</span><strong>id ${row.id}</strong><em>dist_sq ${row.dist}</em></div>`,
      )
      .join("") +
    `</div>`
  );
}

function runQuery() {
  if (!wasm) return;
  const mode = fnSelect.value;
  knnIds = [];
  knnDist2 = [];
  let resultHtml = "";

  if (mode === "1nn") {
    const id = wasm.iface_query_1nn(params.x, params.y);
    const dist2 = wasm.iface_query_distance2(params.x, params.y);
    if (id >= 0) {
      knnIds = [id];
      knnDist2 = [dist2];
    }
    resultHtml = resultRows([
      ["dist_sq", format(dist2, 6)],
      ["payload_id", id >= 0 ? id : "n/a"],
    ]);
  } else if (mode === "knn") {
    const count = wasm.iface_query_knn(params.x, params.y, params.k);
    const ids = new Int32Array(wasm.memory.buffer, wasm.iface_knn_ids(), count);
    const dists = new Float32Array(wasm.memory.buffer, wasm.iface_knn_dist2(), count);
    knnIds = Array.from(ids);
    knnDist2 = Array.from(dists);
    resultHtml = resultList(
      `returned ${count} result(s)`,
      knnIds.map((id, index) => ({ id, dist: format(knnDist2[index], 6) })),
    );
  } else if (mode === "distance2") {
    const dist2 = wasm.iface_query_distance2(params.x, params.y);
    resultHtml = resultRows([["dist_sq", format(dist2, 6)]]);
  } else if (mode === "1nn_if") {
    const id = wasm.iface_query_1nn_if(params.x, params.y, params.filter);
    if (id >= 0) {
      const dx = points[id * 2] - params.x;
      const dy = points[id * 2 + 1] - params.y;
      knnIds = [id];
      knnDist2 = [dx * dx + dy * dy];
    }
    resultHtml = resultRows([
      ["dist_sq", knnDist2.length ? format(knnDist2[0], 6) : "n/a"],
      ["payload_id", id >= 0 ? id : "n/a"],
    ]);
  } else if (mode === "knn_if") {
    const count = wasm.iface_query_knn_if(params.x, params.y, params.k, params.filter);
    const ids = new Int32Array(wasm.memory.buffer, wasm.iface_knn_ids(), count);
    const dists = new Float32Array(wasm.memory.buffer, wasm.iface_knn_dist2(), count);
    knnIds = Array.from(ids);
    knnDist2 = Array.from(dists);
    resultHtml = resultList(
      `returned ${count} result(s)`,
      knnIds.map((id, index) => ({ id, dist: format(knnDist2[index], 6) })),
    );
  } else if (mode === "distance2_if") {
    const dist2 = wasm.iface_query_distance2_if(params.x, params.y, params.filter);
    resultHtml = resultRows([["dist_sq", format(dist2, 6)]]);
  } else if (mode === "ray") {
    const id = wasm.iface_query_ray(
      params.ox,
      params.oy,
      params.dx,
      params.dy,
      params.maxT,
      params.radius,
    );
    const t = wasm.iface_ray_t();
    if (id >= 0) knnIds = [id];
    resultHtml = resultRows([
      ["t", format(t, 6)],
      ["payload_id", id >= 0 ? id : "n/a"],
    ]);
  } else {
    const t = wasm.iface_query_ray_distance(
      params.ox,
      params.oy,
      params.dx,
      params.dy,
      params.maxT,
      params.radius,
    );
    resultHtml = resultRows([["t", format(t, 6)]]);
  }

  resultEl.innerHTML = resultHtml;
  pointsEl.textContent = String(pointCount);
  leavesEl.textContent = String(leafCount);
  draw();
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  if (!points) return;

  ctx.strokeStyle = "rgba(31, 48, 72, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(view.pad, view.pad, view.scale, view.scale);

  if (leavesToggle.checked && leafBoxes) {
    ctx.lineWidth = 1;
    for (let i = 0; i < leafCount; ++i) {
      const b = i * 4;
      const a = toScreen(leafBoxes[b], leafBoxes[b + 1]);
      const c = toScreen(leafBoxes[b + 2], leafBoxes[b + 3]);
      const x = Math.min(a.x, c.x);
      const y = Math.min(a.y, c.y);
      const w = Math.abs(c.x - a.x);
      const h = Math.abs(c.y - a.y);
      ctx.strokeStyle = "rgba(78, 161, 255, 0.24)";
      ctx.strokeRect(x, y, w, h);
    }
  }

  const highlighted = new Set(knnIds);
  for (let i = 0; i < pointCount; ++i) {
    const p = toScreen(points[i * 2], points[i * 2 + 1]);
    const isKnn = highlighted.has(i);
    ctx.fillStyle = isKnn ? "#ffb454" : "#4e9cff";
    const r = isKnn ? 3.4 : 2.2;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }

  if (isRayMode()) {
    const len = Math.hypot(params.dx, params.dy);
    const dx = len > 0 ? params.dx / len : 0;
    const dy = len > 0 ? params.dy / len : 0;
    const a = toScreen(params.ox, params.oy);
    const b = toScreen(
      Math.max(0, Math.min(1, params.ox + dx * params.maxT)),
      Math.max(0, Math.min(1, params.oy + dy * params.maxT)),
    );
    ctx.strokeStyle = "rgba(255, 180, 84, 0.8)";
    ctx.lineWidth = Math.max(1, params.radius * view.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = "#f7f7ff";
    ctx.beginPath();
    ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (knnIds.length) {
      const idx = knnIds[0];
      const q = toScreen(params.x, params.y);
      const p = toScreen(points[idx * 2], points[idx * 2 + 1]);
      ctx.strokeStyle = "rgba(247, 247, 255, 0.55)";
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    const q = toScreen(params.x, params.y);
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f7f7ff";
    ctx.beginPath();
    ctx.arc(q.x, q.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function setQueryFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const point = fromScreen(event.clientX - rect.left, event.clientY - rect.top);
  if (isRayMode()) {
    params.ox = point.x;
    params.oy = point.y;
  } else {
    params.x = point.x;
    params.y = point.y;
  }
  syncInputs();
  runQuery();
}

function rebuild() {
  if (!wasm) return;
  const count = Number(countSelect.value);
  const seed = (Math.random() * 0x7fffffff) | 0;
  const built = wasm.iface_build(seed, count);
  if (!built) throw new Error("iface_build failed");

  pointCount = built;
  leafCount = wasm.iface_leaf_count();
  points = new Float32Array(wasm.memory.buffer, wasm.iface_points(), pointCount * 2).slice();
  leafBoxes = new Float32Array(
    wasm.memory.buffer,
    wasm.iface_leaf_boxes(),
    leafCount * 4,
  ).slice();
  runQuery();
}

async function init() {
  try {
    resize();
    const response = await fetch("wasm/kd3_interface.wasm");
    if (!response.ok) throw new Error(`cannot load kd3_interface.wasm (${response.status})`);
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: makeWasi(),
    });
    wasm = instance.exports;
    statusEl.hidden = true;
    window.addEventListener("resize", resize);
    renderCodeEditor();
    rebuild();
  } catch (error) {
    statusEl.hidden = false;
    statusEl.textContent = "Failed to load demo.";
    if (fatalEl) {
      fatalEl.hidden = false;
      fatalEl.textContent = error.stack || String(error);
    }
    console.error(error);
  }
}

fnSelect.addEventListener("change", () => {
  renderCodeEditor();
  runQuery();
});
countSelect.addEventListener("change", rebuild);
buildButton.addEventListener("click", rebuild);
runButton.addEventListener("click", runQuery);
leavesToggle.addEventListener("change", draw);
canvas.addEventListener("pointermove", setQueryFromEvent);
canvas.addEventListener("pointerdown", setQueryFromEvent);

codeEl.addEventListener("input", (event) => {
  const param = event.target.dataset.param;
  if (!param) return;
  params[param] = Number(event.target.value);
  runQuery();
});
codeEl.addEventListener("change", (event) => {
  const param = event.target.dataset.param;
  if (!param) return;
  params[param] = Number(event.target.value);
  runQuery();
});

await init();
}
