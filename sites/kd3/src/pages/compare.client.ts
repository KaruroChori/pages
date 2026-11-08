import { initHints } from "@pages/ui/Hint";

function start() {
  initHints();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
