// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  mountPlayer,
  type PlayerController,
} from "../src/player";

import { scriptedLifecyclePresentation } from "./fixtures/scripted-lifecycle-presentation";

// ============================================================
// SCRIPTED PLAYER RUNTIME LIFECYCLE
//
// The secure Scripted renderer produces a sandboxed iframe inside the single
// active slide. The Player renders only the current slide into the slide host
// and replaces its innerHTML on navigation. These tests prove that the DOM /
// browsing-context lifecycle already enforces the Scripted contract:
//
//   ACTIVE      -> exactly the renderer-owned iframe is mounted;
//   NAV AWAY    -> the old frame is removed (0 inactive frames);
//   NAV BACK    -> renderSlide() runs again and a FRESH frame is created;
//   GO TO SELF  -> no unnecessary restart;
//   DESTROY     -> all Player DOM (and any iframe) is removed.
//
// The authored html/css/script in the fixture are canonical data transported
// by the renderer into the iframe srcdoc. They are never executed here (no
// eval/Function); jsdom does not run srcdoc iframe JavaScript, which is fine:
// these tests assert structural DOM / browsing-context lifecycle, not script
// execution. Real execution belongs to the later manual/security gate.
// ============================================================

describe("Scripted Player runtime lifecycle", () => {
  let root: HTMLElement;
  let player: PlayerController;

  const scriptedFrames = () =>
    root.querySelectorAll<HTMLIFrameElement>(
      'iframe[data-powershow-type="scripted"]',
    );

  const slideHost = () =>
    root.querySelector<HTMLElement>(".powershow-player-slide-host");

  function mount(): void {
    player = mountPlayer(root, scriptedLifecyclePresentation);
  }

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;

    const element = document.querySelector<HTMLElement>("#app");

    if (!element) {
      throw new Error("Test root was not created.");
    }

    root = element;
  });

  afterEach(() => {
    player?.destroy();

    document.body.replaceChildren();
  });

  // ============================================================
  // INITIAL RENDER
  // ============================================================

  describe("initial render", () => {
    it("mounts exactly one renderer-owned Scripted iframe inside the slide host", () => {
      mount();

      const frames = scriptedFrames();

      expect(frames).toHaveLength(1);

      const host = slideHost();
      expect(host).not.toBeNull();
      expect(host?.contains(frames[0] ?? null)).toBe(true);
    });

    it("ships the renderer sandbox verbatim with no same-origin or extra tokens", () => {
      mount();

      const frame = scriptedFrames()[0];

      expect(frame).toBeDefined();

      expect(frame?.getAttribute("data-powershow-type")).toBe("scripted");
      expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
      // allow-same-origin is explicitly denied by the renderer.
      expect(frame?.getAttribute("sandbox")).not.toContain("allow-same-origin");
      // The Player must not have duplicated or rebuilt sandbox policy: the
      // mounted iframe carries exactly the renderer-owned token and nothing
      // else anywhere in the Player markup.
      expect(root.querySelectorAll("[sandbox]")).toHaveLength(1);
    });

    it("keeps authored Scripted source out of Player app DOM outside the srcdoc transport", () => {
      mount();

      const frame = scriptedFrames()[0];
      expect(frame).toBeDefined();

      // The authored source is present only as escaped data in the iframe
      // srcdoc transport owned by the renderer.
      expect(frame?.getAttribute("srcdoc")).toContain(
        "__powershowScriptedBootCount",
      );

      // No authored <script> element leaks into the Player application DOM.
      expect(root.querySelectorAll("script")).toHaveLength(0);
    });
  });

  // ============================================================
  // NAVIGATE AWAY
  // ============================================================

  describe("navigate away", () => {
    it("removes the Scripted iframe and leaves zero inactive frames", () => {
      mount();

      const first = scriptedFrames()[0];
      expect(first).toBeDefined();
      expect(first?.isConnected).toBe(true);

      player.next();

      expect(player.getCurrentIndex()).toBe(1);

      // The destination slide renders only ordinary content.
      expect(root.innerHTML).toContain("Ordinary Slide");

      // The original frame is detached from the document.
      expect(first?.isConnected).toBe(false);

      // The slide host no longer contains that frame.
      const host = slideHost();
      expect(host?.contains(first ?? null)).toBe(false);

      // No Scripted iframe, hidden or otherwise, remains anywhere under the
      // Player root when the active slide has no Scripted content.
      expect(scriptedFrames()).toHaveLength(0);
    });
  });

  // ============================================================
  // NAVIGATE BACK
  // ============================================================

  describe("navigate back", () => {
    it("recreates a fresh Scripted iframe node on return", () => {
      mount();

      const first = scriptedFrames()[0];
      expect(first).toBeDefined();

      player.next();
      player.previous();

      expect(player.getCurrentIndex()).toBe(0);

      const frames = scriptedFrames();
      expect(frames).toHaveLength(1);

      const revived = frames[0];
      expect(revived).toBeDefined();

      // Fresh runtime: the returned node is NOT the original node.
      expect(revived).not.toBe(first);

      // Sandbox contract is unchanged.
      expect(revived?.getAttribute("sandbox")).toBe("allow-scripts");
      expect(revived?.getAttribute("sandbox")).not.toContain("allow-same-origin");

      // The canonical Scripted payload is present again in the transport.
      expect(revived?.getAttribute("srcdoc")).toContain(
        "__powershowScriptedBootCount",
      );
    });
  });

  // ============================================================
  // GO TO CURRENT SLIDE
  // ============================================================

  describe("go to current slide", () => {
    it("does not restart the active Scripted runtime when target equals current", () => {
      mount();

      const first = scriptedFrames()[0];
      expect(first).toBeDefined();

      player.goTo(player.getCurrentIndex());

      // No rerender: the same frame survives untouched.
      const frames = scriptedFrames();
      expect(frames).toHaveLength(1);
      expect(frames[0]).toBe(first);
      expect(first?.isConnected).toBe(true);
    });
  });

  // ============================================================
  // NEXT / PREVIOUS ROUND TRIPS
  // ============================================================

  describe("next/previous round trips", () => {
    it("keeps exactly one fresh Scripted runtime across repeated navigation", () => {
      mount();

      const original = scriptedFrames()[0];
      expect(original).toBeDefined();

      // Round-trip between the Scripted slide (0) and ordinary slide (1)
      // several times. Each return must produce exactly one fresh runtime and
      // never accumulate stale or repeated frames.
      for (let i = 0; i < 3; i += 1) {
        player.next();
        expect(scriptedFrames()).toHaveLength(0);

        player.previous();
        expect(scriptedFrames()).toHaveLength(1);
      }

      const finalFrame = scriptedFrames()[0];
      expect(finalFrame).toBeDefined();
      expect(finalFrame).not.toBe(original);
    });
  });

  // ============================================================
  // DESTROY
  // ============================================================

  describe("destroy", () => {
    it("removes all Player DOM and disconnects the Scripted iframe idempotently", () => {
      mount();

      const first = scriptedFrames()[0];
      expect(first).toBeDefined();
      expect(first?.isConnected).toBe(true);

      player.destroy();

      // Existing destroy contract: Player root becomes empty.
      expect(root.children.length).toBe(0);

      // The Scripted iframe is disconnected from the document.
      expect(first?.isConnected).toBe(false);

      // No Scripted iframe remains attached anywhere.
      expect(root.querySelectorAll('iframe[data-powershow-type="scripted"]'))
        .toHaveLength(0);

      // destroy remains idempotent.
      expect(() => player.destroy()).not.toThrow();
    });
  });

  // ============================================================
  // MULTIPLE SCRIPTED ELEMENTS
  // ============================================================

  describe("multiple Scripted elements", () => {
    it("mounts, removes, and recreates the correct number of frames without residue", () => {
      mount();
      player.goTo(2);

      const originalFrames = Array.from(scriptedFrames());
      expect(originalFrames).toHaveLength(2);
      for (const frame of originalFrames) {
        expect(frame.isConnected).toBe(true);
      }

      // Navigate away: all of them are removed.
      player.goTo(1);
      expect(scriptedFrames()).toHaveLength(0);
      for (const frame of originalFrames) {
        expect(frame.isConnected).toBe(false);
      }

      // Navigate back: the correct count is recreated.
      player.goTo(2);
      const revivedFrames = Array.from(scriptedFrames());
      expect(revivedFrames).toHaveLength(2);

      // None of the earlier-render frames survive.
      const originalIds = new Set(originalFrames.map((f) => f));
      for (const frame of revivedFrames) {
        expect(originalIds.has(frame)).toBe(false);
      }
    });
  });

  // ============================================================
  // HIDDEN SCRIPTED
  // ============================================================

  describe("hidden Scripted", () => {
    it("produces no iframe for a hidden Scripted element but keeps other content", () => {
      mount();
      player.goTo(3);

      expect(player.getCurrentIndex()).toBe(3);

      // The hidden Scripted element must not produce an iframe.
      expect(scriptedFrames()).toHaveLength(0);

      // Other slide content still renders normally.
      expect(root.innerHTML).toContain("Ordinary Content On Hidden Slide");
    });
  });
});