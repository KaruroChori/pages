// @ts-nocheck
export function mountGlslDemo() {
const canvas = document.getElementById("glsl-canvas");
const stage = document.getElementById("glsl-stage");
const statusEl = document.getElementById("glsl-status");
const fpsEl = document.getElementById("glsl-fps");
const placeholderEl = document.getElementById("glsl-placeholder");
const zoomInButton = document.getElementById("glsl-zoom-in");
const zoomOutButton = document.getElementById("glsl-zoom-out");
const resetButton = document.getElementById("glsl-reset");
const fatalEl = document.getElementById("fatal");

const RENDER_W = 480;
const RENDER_H = 300;
const FRAME_MS = 1000 / 30;
const TEX_WIDTH = 1024;

canvas.width = RENDER_W;
canvas.height = RENDER_H;

const gl = canvas.getContext("webgl2", {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: "low-power",
});

const state = {
  wasm: null,
  ready: false,
  loading: false,
  started: false,
  running: false,
  raf: 0,
  last: 0,
  program: null,
  uniforms: {},
  vao: null,
  pointerInside: false,
  keyboardActive: false,
  dragging: false,
  dragMode: "orbit",
  lastX: 0,
  lastY: 0,
  pointers: new Map(),
  pinchDistance: 0,
  fpsFrames: 0,
  fpsStart: 0,
  camera: {
    yaw: 0.6,
    pitch: 0.42,
    distance: 3.6,
    target: [0, 0, 0],
  },
};

const SHADER_HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;

uniform vec3 ro;
uniform vec3 uu;
uniform vec3 vv;
uniform vec3 ww;
uniform float W;
uniform float H;
uniform vec3 root_bmin;
uniform vec3 root_bmax;
uniform highp sampler2D u_split_vals;
uniform highp usampler2D u_split_dims;
uniform highp usampler2D u_buckets;
uniform highp sampler2D u_boxes;
uniform highp sampler2D u_normals;
uniform uint u_num_buckets;

out vec4 finalColor;

float kd3_fetch_float(highp sampler2D tex, uint i) {
    int w = textureSize(tex, 0).x;
    return texelFetch(tex, ivec2(int(i) % w, int(i) / w), 0).r;
}
uint kd3_fetch_uint(highp usampler2D tex, uint i) {
    int w = textureSize(tex, 0).x;
    return texelFetch(tex, ivec2(int(i) % w, int(i) / w), 0).r;
}
vec4 kd3_fetch_normal(uint i) {
    int w = textureSize(u_normals, 0).x;
    return texelFetch(u_normals, ivec2(int(i) % w, int(i) / w), 0);
}
`;

const SHADER_MAIN = `
void main() {
    float u = (2.0 * gl_FragCoord.x - W) / H;
    float v = (2.0 * gl_FragCoord.y - H) / H;
    vec3 rd = normalize(uu * u + vv * v + ww);
    vec3 bg = mix(vec3(0.015, 0.012, 0.035), vec3(0.06, 0.10, 0.22),
                  clamp(0.5 + 0.5 * rd.y, 0.0, 1.0));
    float glow = pow(max(dot(rd, normalize(vec3(0.4, 0.5, 0.6))), 0.0), 8.0);
    bg += vec3(0.10, 0.14, 0.30) * glow;

    Kd3RayHit hit;
    if (kd3_query_ray(ro, rd, 100.0, 0.018, root_bmin, root_bmax, hit)) {
        vec4 surfel = kd3_fetch_normal(hit.payload_id);
        vec3 n = surfel.xyz;
        float hue = surfel.w;
        vec3 base = 0.55 + 0.45 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + hue));

        vec3 key = normalize(vec3(0.7, 1.0, 0.35));
        vec3 fill = normalize(vec3(-0.6, -0.1, -0.8));
        float key_diff = max(dot(n, key), 0.0);
        float fill_diff = max(dot(n, fill), 0.0);
        float spec = pow(max(dot(n, normalize(key - rd)), 0.0), 42.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);

        vec3 col = base * (0.22 + 0.95 * key_diff);
        col += vec3(0.12, 0.25, 0.55) * fill_diff * 0.55;
        col += vec3(0.35, 0.55, 1.0) * rim * 0.55;
        col += vec3(1.0, 0.92, 0.8) * spec * 0.35;
        col = mix(col, bg, clamp(hit.t / 12.0, 0.0, 0.35));
        finalColor = vec4(col, 1.0);
    } else {
        finalColor = vec4(bg, 1.0);
    }
}
`;

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

function makeWasi() {
  return {
    args_get: () => 0,
    args_sizes_get: () => 0,
    environ_get: () => 0,
    environ_sizes_get: () => 0,
    fd_seek: () => 0,
    fd_write: () => 0,
    fd_close: () => 0,
    proc_exit: (code) => {
      throw new Error(`wasm exited with code ${code}`);
    },
  };
}

function setStatus(text) {
  statusEl.textContent = text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// WebGL2 has no SSBOs and no uint64. This demo-side adapter rewrites the
// generated desktop-GLSL traversal to texture fetches. The kd3 generator is
// unchanged; fail loudly if its output shape changes.
function adaptGlsl(source) {
  let glsl = source;

  const ssboCount = (glsl.match(/layout\(std430/g) || []).length;
  const bucketRefs = (glsl.match(/kd3_buckets\[/g) || []).length;
  const boxRefs = (glsl.match(/kd3_boxes\[/g) || []).length;
  const hasDimFn = /uint kd3_get_dim\(uint i\)/.test(glsl);
  const hasLength = /kd3_buckets\.length\(\)/.test(glsl);
  if (ssboCount !== 4 || bucketRefs === 0 || boxRefs === 0 || !hasDimFn || !hasLength) {
    throw new Error("kd3 GLSL generator output changed; update the WebGL2 adapter");
  }

  glsl = glsl.replace(/layout\(std430[^\n]*\n/g, "");
  glsl = glsl.replace(/uint kd3_get_dim\(uint i\) \{[\s\S]*?\n\}/, `uint kd3_get_dim(uint i) {
    uint idx = i / 32u;
    uint offset = (i % 32u) * 2u;
    int w = textureSize(u_split_dims, 0).x;
    uvec2 word = texelFetch(u_split_dims, ivec2(int(idx) % w, int(idx) / w), 0).xy;
    uint value = (offset < 32u) ? (word.x >> offset) : (word.y >> (offset - 32u));
    return value & 3u;
}`);
  glsl = glsl.replace(
    /uint num_buckets = uint\(kd3_buckets\.length\(\)\) \/ \d+u;/g,
    "uint num_buckets = u_num_buckets;",
  );
  glsl = glsl.replace(/kd3_buckets\[([^\]]+)\]/g, "kd3_fetch_uint(u_buckets, $1)");
  glsl = glsl.replace(/kd3_boxes\[([^\]]+)\]/g, "kd3_fetch_float(u_boxes, $1)");
  glsl = glsl.replace(/kd3_split_vals\[([^\]]+)\]/g, "kd3_fetch_float(u_split_vals, $1)");

  if (/uint64_t|std430|\.length\(\)/.test(glsl)) {
    throw new Error("kd3 GLSL was not fully adapted for WebGL2");
  }
  if (
    !glsl.includes("kd3_fetch_uint(u_buckets,") ||
    !glsl.includes("kd3_fetch_float(u_boxes,")
  ) {
    throw new Error("kd3 GLSL buffer replacement did not run");
  }

  return glsl;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function makeProgram(fragmentSource) {
  const vertex = compileShader(gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader link failed: ${log}`);
  }
  return program;
}

function textureDims(count) {
  return {
    width: TEX_WIDTH,
    height: Math.max(1, Math.ceil(count / TEX_WIDTH)),
  };
}

function padArray(data, components) {
  const { width, height } = textureDims(data.length / components);
  const out = new data.constructor(width * height * components);
  out.set(data);
  return { data: out, width, height };
}

function makeFloatTexture(values) {
  const { data, width, height } = padArray(values, 1);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, data);
  return tex;
}

function makeUintTexture(values) {
  const { data, width, height } = padArray(values, 1);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, data);
  return tex;
}

function makeUintPairTexture(values) {
  const { data, width, height } = padArray(values, 2);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32UI, width, height, 0, gl.RG_INTEGER, gl.UNSIGNED_INT, data);
  return tex;
}

function makeNormalTexture(values) {
  const { data, width, height } = padArray(values, 4);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  return tex;
}

function bindTexture(unit, texture, location) {
  if (!texture) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (location) gl.uniform1i(location, unit);
}

function setupQuad() {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

async function loadWasm() {
  const response = await fetch("wasm/kd3_glsl.wasm");
  if (!response.ok) {
    throw new Error(`cannot load kd3_glsl.wasm (${response.status})`);
  }
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {
    wasi_snapshot_preview1: makeWasi(),
  });
  return instance.exports;
}

function readGlslSource(wasm) {
  const length = wasm.glsl_source_len();
  const bytes = new Uint8Array(wasm.memory.buffer, wasm.glsl_source(), length);
  return new TextDecoder().decode(bytes);
}

function createSceneTextures(wasm) {
  const splitVals = new Float32Array(
    wasm.memory.buffer,
    wasm.glsl_split_vals(),
    wasm.glsl_split_vals_count(),
  ).slice();
  const splitDims = new Uint32Array(
    wasm.memory.buffer,
    wasm.glsl_split_dims(),
    wasm.glsl_split_dims_count() * 2,
  ).slice();
  const buckets = new Uint32Array(
    wasm.memory.buffer,
    wasm.glsl_buckets(),
    wasm.glsl_buckets_count(),
  ).slice();
  const boxes = new Float32Array(
    wasm.memory.buffer,
    wasm.glsl_boxes(),
    wasm.glsl_boxes_count(),
  ).slice();
  const normals = new Float32Array(
    wasm.memory.buffer,
    wasm.glsl_normals(),
    wasm.glsl_surfel_count() * 4,
  ).slice();
  const rootMin = new Float32Array(wasm.memory.buffer, wasm.glsl_root_min(), 3).slice();
  const rootMax = new Float32Array(wasm.memory.buffer, wasm.glsl_root_max(), 3).slice();

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  return {
    splitVals: makeFloatTexture(splitVals),
    splitDims: makeUintPairTexture(splitDims),
    buckets: makeUintTexture(buckets),
    boxes: makeFloatTexture(boxes),
    normals: makeNormalTexture(normals),
    numBuckets: wasm.glsl_num_buckets(),
    rootMin,
    rootMax,
  };
}

async function ensureReady() {
  if (state.ready) return;

  if (!gl) {
    throw new Error("WebGL2 is not available in this browser.");
  }

  setStatus("Building the kd3 tree in WebAssembly...");
  placeholderEl.textContent = "Building the kd3 tree and compiling the shader...";
  const wasm = await loadWasm();
  state.wasm = wasm;
  if (!wasm.glsl_build()) {
    throw new Error("kd3 tree build failed.");
  }

  const glslSource = readGlslSource(wasm);

  setStatus("Compiling the kd3-generated GLSL shader...");
  const fragmentSource = SHADER_HEADER + adaptGlsl(glslSource) + SHADER_MAIN;
  const program = makeProgram(fragmentSource);
  gl.useProgram(program);

  const uniforms = {};
  for (const name of [
    "ro", "uu", "vv", "ww", "W", "H", "root_bmin", "root_bmax",
    "u_split_vals", "u_split_dims", "u_buckets", "u_boxes", "u_normals",
    "u_num_buckets",
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  const textures = createSceneTextures(wasm);
  gl.uniform1f(uniforms.W, RENDER_W);
  gl.uniform1f(uniforms.H, RENDER_H);
  gl.uniform3fv(uniforms.root_bmin, textures.rootMin);
  gl.uniform3fv(uniforms.root_bmax, textures.rootMax);
  if (uniforms.u_num_buckets) gl.uniform1ui(uniforms.u_num_buckets, textures.numBuckets);

  bindTexture(0, textures.splitVals, uniforms.u_split_vals);
  bindTexture(1, textures.splitDims, uniforms.u_split_dims);
  bindTexture(2, textures.buckets, uniforms.u_buckets);
  bindTexture(3, textures.boxes, uniforms.u_boxes);
  bindTexture(4, textures.normals, uniforms.u_normals);

  state.program = program;
  state.uniforms = uniforms;
  state.vao = setupQuad();
  state.ready = true;
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cameraVectors() {
  const camera = state.camera;
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const ro = [
    camera.target[0] + camera.distance * cp * Math.sin(camera.yaw),
    camera.target[1] + camera.distance * sp,
    camera.target[2] + camera.distance * cp * Math.cos(camera.yaw),
  ];
  const ww = normalize(subtract(camera.target, ro));
  const uu = normalize(cross([0, 1, 0], ww));
  const vv = cross(ww, uu);
  return { ro, uu, vv, ww };
}

function render() {
  const { ro, uu, vv, ww } = cameraVectors();

  gl.useProgram(state.program);
  gl.uniform3fv(state.uniforms.ro, ro);
  gl.uniform3fv(state.uniforms.uu, uu);
  gl.uniform3fv(state.uniforms.vv, vv);
  gl.uniform3fv(state.uniforms.ww, ww);

  gl.bindVertexArray(state.vao);
  gl.viewport(0, 0, RENDER_W, RENDER_H);
  gl.clearColor(0.015, 0.02, 0.04, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function frame(now) {
  if (!state.running) return;
  state.raf = requestAnimationFrame(frame);
  if (now - state.last < FRAME_MS) return;
  state.last = now;
  render();

  state.fpsFrames += 1;
  if (now - state.fpsStart >= 500) {
    const fps = (state.fpsFrames * 1000) / (now - state.fpsStart);
    fpsEl.textContent = `${fps.toFixed(1)} fps`;
    state.fpsFrames = 0;
    state.fpsStart = now;
  }
}

function startRendering() {
  if (!state.ready || state.running) return;
  state.running = true;
  state.last = 0;
  state.fpsFrames = 0;
  state.fpsStart = performance.now();
  setStatus("Rendering. Move the pointer out of the box to pause.");
  state.raf = requestAnimationFrame(frame);
}

function stopRendering(message) {
  if (!state.running) return;
  state.running = false;
  cancelAnimationFrame(state.raf);
  fpsEl.textContent = "fps --";
  setStatus(message || "Paused. Interact with the canvas to render.");
}

async function activate(force = false) {
  if (!state.ready) {
    if (state.loading) return;
    state.loading = true;
    try {
      await ensureReady();
    } catch (error) {
      state.loading = false;
      placeholderEl.textContent = "Failed to start the GLSL renderer.";
      setStatus("Failed to start the GLSL renderer.");
      if (fatalEl) {
        fatalEl.hidden = false;
        fatalEl.textContent = error.stack || String(error);
      }
      console.error(error);
      return;
    }
    state.loading = false;
    state.started = true;
    placeholderEl.hidden = true;
  }
  if (force || state.pointerInside || state.keyboardActive) startRendering();
}

function zoomBy(factor) {
  state.camera.distance = clamp(state.camera.distance * factor, 1.8, 8);
  activate();
}

function resetView() {
  state.camera.yaw = 0.6;
  state.camera.pitch = 0.42;
  state.camera.distance = 3.6;
  state.camera.target = [0, 0, 0];
  activate();
}

function orbit(dx, dy) {
  state.camera.yaw -= dx * 0.006;
  state.camera.pitch = clamp(state.camera.pitch - dy * 0.006, -1.35, 1.35);
}

function pan(dx, dy) {
  const { uu, vv } = cameraVectors();
  const scale = state.camera.distance * 0.0016;
  const target = state.camera.target;
  target[0] += (-dx * uu[0] + dy * vv[0]) * scale;
  target[1] += (-dx * uu[1] + dy * vv[1]) * scale;
  target[2] += (-dx * uu[2] + dy * vv[2]) * scale;
}

function pointerDistance() {
  const points = [...state.pointers.values()];
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!gl) return;
  event.preventDefault();
  canvas.focus();
  state.pointerInside = true;
  state.dragging = true;
  state.dragMode = event.button === 2 || event.shiftKey ? "pan" : "orbit";
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.pointers.size === 2) {
    state.dragMode = "pinch";
    state.pinchDistance = pointerDistance();
  }
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic events and some touch environments do not support capture.
  }
  activate();
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.pointers.size >= 2) {
    const distance = pointerDistance();
    if (state.pinchDistance > 0 && distance > 0) {
      state.camera.distance = clamp(
        state.camera.distance * (state.pinchDistance / distance),
        1.8,
        8,
      );
    }
    state.pinchDistance = distance;
    return;
  }

  const dx = event.clientX - state.lastX;
  const dy = event.clientY - state.lastY;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  if (state.dragMode === "pan") pan(dx, dy);
  else orbit(dx, dy);
});

function endPointer(event) {
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 1) {
    const point = [...state.pointers.values()][0];
    state.lastX = point.x;
    state.lastY = point.y;
    state.dragMode = "orbit";
    state.pinchDistance = 0;
  } else if (state.pointers.size === 0) {
    state.dragging = false;
    state.pinchDistance = 0;
    if (event.pointerType !== "mouse") state.pointerInside = false;
    if (!state.pointerInside) stopRendering("Paused. Interact with the canvas to render.");
  }
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
stage.addEventListener("pointerenter", () => {
  state.pointerInside = true;
  if (state.started && state.ready) startRendering();
});
stage.addEventListener("pointerleave", () => {
  state.pointerInside = false;
  if (!state.dragging) {
    stopRendering("Paused. Move the pointer into the box to render.");
  }
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.camera.distance = clamp(
      state.camera.distance * Math.exp(event.deltaY * 0.001),
      1.8,
      8,
    );
    activate();
  },
  { passive: false },
);

canvas.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key === "ArrowLeft") orbit(-40, 0);
  else if (key === "ArrowRight") orbit(40, 0);
  else if (key === "ArrowUp") orbit(0, -40);
  else if (key === "ArrowDown") orbit(0, 40);
  else if (key === "+" || key === "=") {
    state.camera.distance = clamp(state.camera.distance * 0.82, 1.8, 8);
  } else if (key === "-" || key === "_") {
    state.camera.distance = clamp(state.camera.distance * 1.22, 1.8, 8);
  } else if (key === "r" || key === "R") {
    resetView();
  } else if (key === "Escape") {
    stopRendering("Paused.");
  } else {
    return;
  }
  event.preventDefault();
  if (key !== "Escape") activate(true);
});

canvas.addEventListener("focus", () => {
  state.keyboardActive = true;
  if (state.started && state.ready) startRendering();
});

canvas.addEventListener("blur", () => {
  state.keyboardActive = false;
  if (!state.pointerInside) stopRendering("Paused. Interact with the canvas to render.");
});

zoomInButton.addEventListener("click", () => zoomBy(0.82));
zoomOutButton.addEventListener("click", () => zoomBy(1.22));
resetButton.addEventListener("click", resetView);
canvas.addEventListener("dblclick", resetView);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running) {
    stopRendering("Paused because the tab is hidden.");
  }
});

if (!gl) {
  setStatus("WebGL2 is not available in this browser.");
  placeholderEl.textContent = "WebGL2 is required for the kd3 GLSL raytracing demo.";
  zoomInButton.disabled = true;
  zoomOutButton.disabled = true;
  resetButton.disabled = true;
} else {
  setStatus("Interact with the canvas to render. 480 by 300, 30 fps cap.");
}
}
