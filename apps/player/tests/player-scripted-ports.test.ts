// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

import { mountPlayer } from "../src/player";

const presentation = PresentationSchema.parse({
  schemaVersion: 1,
  id: "player-scripted-ports",
  title: "Scripted ports",
  description: "",
  aspectRatio: "16:9",
  slides: [
    {
      id: "scripted",
      elements: [{
        id: "scripted-scroll",
        type: "scripted",
        title: "Scroll",
        html: "",
        css: "",
        script: "",
        ports: [
          { id: "scroll-up", label: "Scroll up", kind: "action" },
          { id: "scroll-down", label: "Scroll down", kind: "action" },
          { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
          { id: "current", label: "Current", kind: "number", direction: "output" },
        ],
      }],
    },
    { id: "other", elements: [] },
  ],
});

describe("Player public Scripted ports", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>("#app")!;
  });

  afterEach(() => document.body.replaceChildren());

  function frame(): HTMLIFrameElement {
    const result = root.querySelector<HTMLIFrameElement>('iframe[data-powershow-id="scripted-scroll"]');
    if (!result) throw new Error("Scripted iframe not found");
    return result;
  }

  function report(source: WindowProxy | null, value = 0.12): void {
    window.dispatchEvent(new MessageEvent("message", {
      source,
      data: { type: "powershow:scripted:report", elementId: "scripted-scroll", portId: "current", value },
    }));
  }

  it("delegates distinct action and validated input envelopes through the public API", () => {
    const player = mountPlayer(root, presentation, { controlsAutoHideMs: null });
    const contentWindow = frame().contentWindow!;
    const postMessage = vi.spyOn(contentWindow, "postMessage");

    expect(player.sendScriptedAction).toBeTypeOf("function");
    expect(player.sendScriptedInput).toBeTypeOf("function");
    player.sendScriptedAction("scripted-scroll", "scroll-up");
    player.sendScriptedAction("scripted-scroll", "scroll-down");
    player.sendScriptedAction("scripted-scroll", "missing");
    player.sendScriptedInput("scripted-scroll", "enabled", true);
    player.sendScriptedInput("scripted-scroll", "enabled", 1);

    expect(postMessage).toHaveBeenNthCalledWith(1, { type: "powershow:scripted:action", elementId: "scripted-scroll", portId: "scroll-up" }, "*");
    expect(postMessage).toHaveBeenNthCalledWith(2, { type: "powershow:scripted:action", elementId: "scripted-scroll", portId: "scroll-down" }, "*");
    expect(postMessage).toHaveBeenNthCalledWith(3, { type: "powershow:scripted:input", elementId: "scripted-scroll", portId: "enabled", value: true }, "*");
    expect(postMessage).toHaveBeenCalledTimes(3);
    player.destroy();
  });

  it("forwards only validated current-frame reports and removes the bridge on destroy", () => {
    const onScriptedReport = vi.fn();
    const player = mountPlayer(root, presentation, { controlsAutoHideMs: null, onScriptedReport });
    const oldWindow = frame().contentWindow;

    report(oldWindow);
    report(window);
    expect(onScriptedReport).toHaveBeenCalledExactlyOnceWith({ type: "powershow:scripted:report", elementId: "scripted-scroll", portId: "current", value: 0.12 });

    player.goTo(1);
    report(oldWindow, 0.2);
    expect(onScriptedReport).toHaveBeenCalledTimes(1);

    player.destroy();
    report(oldWindow, 0.3);
    expect(onScriptedReport).toHaveBeenCalledTimes(1);
  });
});
