// @ts-nocheck
export async function mountCloudDemo() {
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d", { alpha: false });
const statusEl = document.getElementById("status");
const fatalEl = document.getElementById("fatal");
const pointCountEl = document.getElementById("point-count");
const nearestIdEl = document.getElementById("nearest-id");
const nearestDistanceEl = document.getElementById("nearest-distance");

const qx = document.getElementById("qx");
const qy = document.getElementById("qy");
const qz = document.getElementById("qz");
const kInput = document.getElementById("k");
const qxValue = document.getElementById("qx-value");
const qyValue = document.getElementById("qy-value");
const qzValue = document.getElementById("qz-value");
const kValue = document.getElementById("k-value");
const autoRotate = document.getElementById("auto-rotate");
const resetView = document.getElementById("reset-view");

const state = {
  yaw: 0.72,
  pitch: 0.34,
  distance: 4.4,
  autoRotate: true,
};

const query = { x: 0.4, y: 0.3, z: 0.3, k: 1 };

let wasm = null;
let points = null;
let pointCount = 0;
let nearestId = -1;
let nearestDist2 = Infinity;
let knnIds = [];
let knnDist2 = [];
let dragging = false;
let lastPointer = { x: 0, y: 0 };
const view = { cx: 0, cy: 0, focal: 1, dpr: 1 };

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

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.dpr = dpr;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.cx = rect.width / 2;
  view.cy = rect.height / 2;
  view.focal = Math.min(rect.width, rect.height) * 0.86;
}

function readQueryInputs() {
  query.x = Number(qx.value);
  query.y = Number(qy.value);
  query.z = Number(qz.value);
  query.k = Number(kInput.value);
  qxValue.textContent = query.x.toFixed(2);
  qyValue.textContent = query.y.toFixed(2);
  qzValue.textContent = query.z.toFixed(2);
  kValue.textContent = String(query.k);
}

function runQuery() {
  if (!wasm) return;
  nearestId = wasm.demo_query_1nn(query.x, query.y, query.z);
  const n = wasm.demo_query_knn(query.x, query.y, query.z, query.k);
  const ids = new Int32Array(wasm.memory.buffer, wasm.demo_knn_ids(), n);
  const dists = new Float32Array(wasm.memory.buffer, wasm.demo_knn_dist2(), n);
  knnIds = Array.from(ids);
  knnDist2 = Array.from(dists);
  nearestId = knnIds.length ? knnIds[0] : -1;
  nearestDist2 = knnDist2.length ? knnDist2[0] : Infinity;
  updateStats();
}

function updateStats() {
  pointCountEl.textContent = String(pointCount);
  nearestIdEl.textContent = nearestId < 0 ? "n/a" : String(nearestId);
  nearestDistanceEl.textContent = Number.isFinite(nearestDist2)
    ? Math.sqrt(nearestDist2).toFixed(4)
    : "n/a";
}

function project(p) {
  const cy = Math.cos(state.yaw);
  const sy = Math.sin(state.yaw);
  const cp = Math.cos(state.pitch);
  const sp = Math.sin(state.pitch);

  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const depth = z2 + state.distance;
  if (depth <= 0.2) return null;

  const scale = view.focal / depth;
  return { sx: view.cx + x1 * scale, sy: view.cy - y2 * scale, depth };
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  if (!points) return;

  const projected = [];
  for (let i = 0; i < pointCount; ++i) {
    const base = i * 3;
    const p = project({ x: points[base], y: points[base + 1], z: points[base + 2] });
    if (p) projected.push({ id: i, sx: p.sx, sy: p.sy, depth: p.depth });
  }

  projected.sort((a, b) => b.depth - a.depth);

  const highlighted = new Set(knnIds);
  ctx.fillStyle = "#4e9cff";
  for (const p of projected) {
    if (p.depth < 0 || highlighted.has(p.id)) continue;
    const r = Math.max(0.7, 2.1 - p.depth * 0.2);
    ctx.fillRect(p.sx - r, p.sy - r, r * 2, r * 2);
  }

  const nearest = projected.find((p) => p.id === nearestId && p.depth >= 0);
  const queryPoint = project(query);
  if (nearest && queryPoint) {
    ctx.strokeStyle = "rgba(247, 247, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(queryPoint.sx, queryPoint.sy);
    ctx.lineTo(nearest.sx, nearest.sy);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffb454";
  for (const p of projected) {
    if (p.depth < 0 || !highlighted.has(p.id)) continue;
    const r = Math.max(1.1, 2.8 - p.depth * 0.22);
    ctx.fillRect(p.sx - r, p.sy - r, r * 2, r * 2);
  }

  if (queryPoint) {
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#f7f7ff";
    ctx.beginPath();
    ctx.arc(queryPoint.sx, queryPoint.sy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(130, 150, 173, 0.9)";
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(`k = ${query.k}`, width - 72, 22);
}

function frame() {
  if (state.autoRotate && !dragging) state.yaw += 0.0024;
  draw();
  requestAnimationFrame(frame);
}

async function init() {
  try {
    resize();
    const response = await fetch("wasm/kd3_web.wasm");
    if (!response.ok) throw new Error(`cannot load kd3_web.wasm (${response.status})`);
    const bytes = await response.arrayBuffer();

    const { instance } = await WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: makeWasi(),
    });
    wasm = instance.exports;

    pointCount = wasm.demo_init();
    if (!pointCount) throw new Error("demo_init failed");

    const ptr = wasm.demo_points();
    points = new Float32Array(wasm.memory.buffer, ptr, pointCount * 3).slice();

    statusEl.hidden = true;
    readQueryInputs();
    runQuery();
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  } catch (error) {
    statusEl.hidden = false;
    statusEl.textContent = "Failed to load demo.";
    fatalEl.hidden = false;
    fatalEl.textContent = error.stack || String(error);
    console.error(error);
  }
}

for (const input of [qx, qy, qz, kInput]) {
  input.addEventListener("input", () => {
    readQueryInputs();
    runQuery();
  });
}

autoRotate.addEventListener("change", () => {
  state.autoRotate = autoRotate.checked;
});

resetView.addEventListener("click", () => {
  state.yaw = 0.72;
  state.pitch = 0.34;
  state.distance = 4.4;
});

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  state.yaw += dx * 0.008;
  state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + dy * 0.006));
});

function endDrag() {
  dragging = false;
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.distance = Math.max(2.2, Math.min(9.0, state.distance * Math.exp(event.deltaY * 0.001)));
  },
  { passive: false },
);

await init();
}
