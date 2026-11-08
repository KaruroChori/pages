
export function GlslDemo() {

  return (
    <div className="glsl-card">
      <div className="glsl-toolbar">
        <span id="glsl-status">
          Interact with the canvas to render. 480 by 300, 30 fps cap.
        </span>
        <span id="glsl-fps">fps --</span>
      </div>

      <div className="glsl-stage" id="glsl-stage">
        <canvas
          id="glsl-canvas"
          width="480"
          height="300"
          tabindex={0}
          aria-label="kd3 GLSL raytraced torus knot"
        />
        <div id="glsl-placeholder">
          Click or scroll to start. Drag to orbit, wheel to zoom.
        </div>
        <div className="glsl-controls">
          <button id="glsl-zoom-in" type="button" aria-label="Zoom in">
            +
          </button>
          <button id="glsl-zoom-out" type="button" aria-label="Zoom out">
            -
          </button>
          <button id="glsl-reset" type="button">
            Reset
          </button>
        </div>
        <div className="glsl-help">
          Drag: orbit &middot; Wheel: zoom &middot; Right-drag or Shift-drag:
          pan
          <br />
          Keys: arrows orbit &middot; +/- zoom &middot; R reset
        </div>
      </div>
    </div>
  );
}
