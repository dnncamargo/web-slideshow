// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

import { mountProjectionSurface } from "../src/projection-surface";

function scripted(id: string, ports: unknown[]): unknown {
  return {
    id,
    type: "scripted",
    title: id,
    html: "",
    css: "",
    script: "",
    ports,
  };
}

const presentation = PresentationSchema.parse({
  schemaVersion: 1,
  id: "scripted-port-bridge",
  title: "Scripted ports",
  description: "",
  aspectRatio: "16:9",
  slides: [
    {
      id: "scripted-slide",
      elements: [
        scripted("scripted-a", [
          { id: "reset", label: "Reset", kind: "action" },
          { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
          { id: "current", label: "Current", kind: "number", direction: "input-output", min: 0, max: 10, step: 5 },
          { id: "reported", label: "Reported", kind: "boolean", direction: "output" },
        ]),
        scripted("scripted-b", [
          { id: "reset", label: "Reset B", kind: "action" },
        ]),
        {
          id: "nested-owner",
          type: "container",
          children: [
            scripted('nested [selector] "<&', [
              { id: "nested-action", label: "Nested", kind: "action" },
            ]),
          ],
        },
      ],
    },
    { id: "ordinary-slide", elements: [] },
  ],
});

describe("Scripted ProjectionSurface port bridge", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>("#app")!;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function frame(elementId: string): HTMLIFrameElement {
    for (const candidate of root.querySelectorAll<HTMLIFrameElement>(
      'iframe[data-powershow-type="scripted"][data-powershow-id]',
    )) {
      if (candidate.dataset.powershowId === elementId) {
        return candidate;
      }
    }

    throw new Error(`Scripted frame not found: ${elementId}`);
  }

  function postSpy(elementId: string) {
    const contentWindow = frame(elementId).contentWindow;

    if (!contentWindow) {
      throw new Error("Scripted frame has no content window");
    }

    return vi.spyOn(contentWindow, "postMessage");
  }

  it("routes exact action envelopes only to valid matching Scripted frames", () => {
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const first = postSpy("scripted-a");
    const second = postSpy("scripted-b");
    const nested = postSpy('nested [selector] "<&');

    projection.sendScriptedAction("scripted-a", "reset");
    projection.sendScriptedAction("scripted-b", "reset");
    projection.sendScriptedAction('nested [selector] "<&', "nested-action");
    projection.sendScriptedAction("missing", "reset");
    projection.sendScriptedAction("scripted-a", "enabled");
    projection.sendScriptedAction("scripted-a", "missing");

    expect(first).toHaveBeenCalledExactlyOnceWith({
      type: "powershow:scripted:action",
      elementId: "scripted-a",
      portId: "reset",
    }, "*");
    expect(second).toHaveBeenCalledExactlyOnceWith({
      type: "powershow:scripted:action",
      elementId: "scripted-b",
      portId: "reset",
    }, "*");
    expect(nested).toHaveBeenCalledExactlyOnceWith({
      type: "powershow:scripted:action",
      elementId: 'nested [selector] "<&',
      portId: "nested-action",
    }, "*");

    projection.destroy();
  });

  it("validates input direction, primitive type, finite bounds, and leaves step unquantized", () => {
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const spy = postSpy("scripted-a");

    expect(projection.sendScriptedInput("scripted-a", "enabled", true)).toBe(true);
    expect(projection.sendScriptedInput("scripted-a", "enabled", 1)).toBe(false);
    expect(projection.sendScriptedInput("scripted-a", "current", 2.5)).toBe(true);
    projection.sendScriptedInput("scripted-a", "current", Number.NaN);
    projection.sendScriptedInput("scripted-a", "current", Number.POSITIVE_INFINITY);
    projection.sendScriptedInput("scripted-a", "current", -0.1);
    projection.sendScriptedInput("scripted-a", "current", 10.1);
    expect(projection.sendScriptedInput("scripted-a", "reported", false)).toBe(false);
    projection.sendScriptedInput("scripted-a", "reset", true);

    expect(spy).toHaveBeenNthCalledWith(1, {
      type: "powershow:scripted:input",
      elementId: "scripted-a",
      portId: "enabled",
      value: true,
    }, "*");
    expect(spy).toHaveBeenNthCalledWith(2, {
      type: "powershow:scripted:input",
      elementId: "scripted-a",
      portId: "current",
      value: 2.5,
    }, "*");
    expect(spy).toHaveBeenCalledTimes(2);

    projection.destroy();
  });

  it("accepts only reports from the exact current iframe with an exact valid envelope", () => {
    const reports: unknown[] = [];
    const projection = mountProjectionSurface(root, presentation, {
      transition: "none",
      onScriptedReport: (report) => reports.push(report),
    });
    const currentFrame = frame("scripted-a");
    const otherFrame = frame("scripted-b");

    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 2.5,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: otherFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 3,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 3,
        extra: true,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "other-element",
        portId: "current",
        value: 3,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "missing",
        value: 3,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "enabled",
        value: true,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: Number.NaN,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: true,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 10.1,
      },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: -0.1,
      },
    }));

    expect(reports).toEqual([{
      type: "powershow:scripted:report",
      elementId: "scripted-a",
      portId: "current",
      value: 2.5,
    }]);

    projection.destroy();
  });

  it("rejects stale reports after navigation and removes its listener on idempotent destroy", () => {
    const reports: unknown[] = [];
    const projection = mountProjectionSurface(root, presentation, {
      transition: "none",
      onScriptedReport: (report) => reports.push(report),
    });
    const oldFrame = frame("scripted-a");

    projection.goTo(1);
    window.dispatchEvent(new MessageEvent("message", {
      source: oldFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 2.5,
      },
    }));

    projection.goTo(0);
    const currentFrame = frame("scripted-a");
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 2.5,
      },
    }));

    projection.destroy();
    projection.destroy();
    window.dispatchEvent(new MessageEvent("message", {
      source: currentFrame.contentWindow,
      data: {
        type: "powershow:scripted:report",
        elementId: "scripted-a",
        portId: "current",
        value: 3,
      },
    }));

    expect(reports).toEqual([{
      type: "powershow:scripted:report",
      elementId: "scripted-a",
      portId: "current",
      value: 2.5,
    }]);
  });
});
