let popover: HTMLDivElement | null = null;
let active: HTMLButtonElement | null = null;

function getPopover() {
  if (!popover) {
    popover = document.createElement("div");
    popover.className = "hint-popover";
    popover.setAttribute("role", "tooltip");
    popover.hidden = true;
    document.body.appendChild(popover);
  }
  return popover;
}

function position(trigger: HTMLButtonElement) {
  const el = getPopover();
  const rect = trigger.getBoundingClientRect();
  const pad = 8;
  const gap = 8;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
  let top = rect.top - height - gap;
  if (top < pad) top = rect.bottom + gap;
  if (top + height > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - height - pad);
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function show(trigger: HTMLButtonElement) {
  const tip = trigger.dataset.tip;
  if (!tip) return;
  active = trigger;
  const el = getPopover();
  el.textContent = tip;
  el.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  position(trigger);
}

function hide() {
  if (active) active.setAttribute("aria-expanded", "false");
  active = null;
  if (popover) popover.hidden = true;
}

function attach(trigger: HTMLButtonElement) {
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") show(trigger);
  });
  trigger.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") hide();
  });
  trigger.addEventListener("focus", () => {
    if (trigger.matches(":focus-visible")) show(trigger);
  });
  trigger.addEventListener("blur", hide);
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail === 0) return;
    if (active === trigger) hide();
    else show(trigger);
  });
}

let initialized = false;

export function initHints() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("pointerdown", (event) => {
    if (active && !active.contains(event.target as Node)) hide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
  window.addEventListener("resize", () => {
    if (active) position(active);
  });
  window.addEventListener("scroll", () => {
    if (active) position(active);
  }, { passive: true });

  for (const trigger of document.querySelectorAll<HTMLButtonElement>(".hint-mark")) {
    attach(trigger);
  }
}

export function Hint({ tip }: { tip: string }) {
  return (
    <button
      type="button"
      className="hint-mark"
      data-tip={tip}
      aria-label="More information"
    >
      i
    </button>
  );
}
