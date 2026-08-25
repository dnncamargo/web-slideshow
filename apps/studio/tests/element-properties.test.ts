import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { getElementPropertyEntries } from "../src/features/editor/element-properties";

function entriesFor(element: PowerShowElement): Record<string, string> {
  return Object.fromEntries(
    getElementPropertyEntries(element).map((entry) => [
      entry.path,
      entry.displayValue,
    ]),
  );
}

describe("getElementPropertyEntries", () => {
  it("flattens authored canonical values without identity metadata", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "hero-title",
      hidden: false,
      variant: "title",
      content: "Introduction to PWM",
      layout: { position: "absolute", top: "8%" },
    };

    expect(getElementPropertyEntries(element)).toEqual([
      { path: "hidden", displayValue: "false" },
      { path: "variant", displayValue: "title" },
      { path: "content", displayValue: "Introduction to PWM" },
      { path: "layout.position", displayValue: "absolute" },
      { path: "layout.top", displayValue: "8%" },
    ]);
  });

  it("renders image sources and scalar values deterministically", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "company-logo",
      hidden: false,
      src: "https://example.com/logo.svg",
      alt: "PowerShow",
      fit: "contain",
      effect: { opacity: 0.9 },
    };

    expect(entriesFor(element)).toMatchObject({
      hidden: "false",
      src: "https://example.com/logo.svg",
      alt: "PowerShow",
      fit: "contain",
      "effect.opacity": "0.9",
    });
  });

  it("represents null, omits undefined, and summarizes arrays", () => {
    const element = {
      type: "container",
      id: "container-1",
      hidden: false,
      role: undefined,
      children: [{ type: "text" }, { type: "image" }],
      style: { background: null },
    } as unknown as PowerShowElement;

    expect(entriesFor(element)).toMatchObject({
      hidden: "false",
      children: "2 items",
      "style.background": "null",
    });
    expect(getElementPropertyEntries(element).some((entry) => entry.path === "children.0.type")).toBe(false);
    expect(getElementPropertyEntries(element).some((entry) => entry.path === "role")).toBe(false);
  });

  it("does not mutate the source and does not invent absent defaults", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "plain-text",
      hidden: false,
      variant: "body",
      content: "Text",
    };
    const before = JSON.stringify(element);

    expect(getElementPropertyEntries(element).some((entry) => entry.path === "typography.fontSize")).toBe(false);
    expect(JSON.stringify(element)).toBe(before);
  });
});
