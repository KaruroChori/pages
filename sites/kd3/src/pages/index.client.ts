import { mountCloudDemo } from "../features/demos/cloud/cloudMount";
import { mountGlslDemo } from "../features/demos/glsl/glslMount";
import { mountInterfaceDemo } from "../features/demos/interface/interfaceMount";

function start() {
  void mountInterfaceDemo();
  void mountCloudDemo();
  mountGlslDemo();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
