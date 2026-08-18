const AUTHORED_LINK_SELECTOR = 'a[data-powershow-link="true"]';

// ============================================================
// BEGIN: CANVAS LINK INTERCEPTION
//
// The Editor canvas renders the shared Player renderer output,
// so authored PowerShow links are native anchors inside the
// editor preview. This helper lets the Editor suppress link
// activation while authoring without removing the href or
// changing the shared renderer.
//
// Player and Watch use native anchor behavior and never call
// this helper.
// ============================================================

export function isAuthoredPowerShowLink(
  target: EventTarget | null | undefined,
): boolean {
  return (
    target instanceof Element &&
    target.closest(AUTHORED_LINK_SELECTOR) !== null
  );
}

// ============================================================
// END: CANVAS LINK INTERCEPTION
// ============================================================