import type { LinkedCodeStyle, LinkedDividerStyle, LinkedSimpleTableStyle, LinkedStructuredTableStyle, LinkedTerminalStyle } from "@web-slideshow/document-schema";
import { describe, expect, it } from "vitest";

import {
  addTargetLinkedStyleProperty,
  listAvailableTargetLinkedStyleProperties,
  listTargetLinkedStyleAuthoredProperties,
  removeTargetLinkedStyleProperty,
  setTargetLinkedStylePropertyValue,
} from "../src/features/editor/target-linked-style-property-authoring";

describe("target linked style property authoring", () => {
  it("keeps position edges unavailable until position is authored", () => {
    const style = { target: "code", id: "code", name: "Code", style: { color: "#fff" } } as LinkedCodeStyle;
    expect(listAvailableTargetLinkedStyleProperties(style)).not.toContain("layout.top");
    const positioned = addTargetLinkedStyleProperty(style, "layout.position");
    expect(positioned.layout?.position).toBe("absolute");
    expect(listAvailableTargetLinkedStyleProperties(positioned)).toContain("layout.top");
  });

  it("detects falsey values and protects the last authored property", () => {
    const style = { target: "divider", id: "divider", name: "Divider", effect: { opacity: 0 } } as LinkedDividerStyle;
    expect(listTargetLinkedStyleAuthoredProperties(style)).toContain("effect.opacity");
    expect(removeTargetLinkedStyleProperty(style, "effect.opacity")).toBe(style);
  });

  it("cleans only the removed nested background member", () => {
    const style = { target: "code", id: "code", name: "Code", style: { background: { color: "#000", gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] } } } } as LinkedCodeStyle;
    const next = removeTargetLinkedStyleProperty(style, "style.background.color");
    expect(next).not.toBe(style);
    expect(next.style?.background?.color).toBeUndefined();
    expect(next.style?.background?.gradient).toBeDefined();
  });

  it("rejects incompatible and invalid authored properties", () => {
    const style = { target: "table", mode: "structured", id: "table", name: "Table", style: { dividerOpacity: 0 } } as LinkedStructuredTableStyle;
    expect(listAvailableTargetLinkedStyleProperties(style)).not.toContain("typography.fontSize");
    expect(setTargetLinkedStylePropertyValue(style, "typography.fontSize", 18)).toBe(style);
    expect(setTargetLinkedStylePropertyValue(style, "style.dividerOpacity", 2)).toBe(style);
  });

  it("derives every target contract from the shared matrix", () => {
    const terminal = { target: "terminal", id: "terminal", name: "Terminal", typography: { fontSize: 14 }, titleTypography: { fontSize: 16 } } as LinkedTerminalStyle;
    const simple = { target: "table", mode: "simple", id: "simple", name: "Simple", typography: { fontSize: 14 } } as LinkedSimpleTableStyle;
    const structured = { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#111111", dividerOpacity: 0 } } as LinkedStructuredTableStyle;
    const divider = { target: "divider", id: "divider", name: "Divider", style: { borderRadius: 2 } } as LinkedDividerStyle;
    expect(listTargetLinkedStyleAuthoredProperties(terminal)).toEqual(expect.arrayContaining(["typography.fontSize", "titleTypography.fontSize"]));
    expect(listAvailableTargetLinkedStyleProperties(terminal)).toContain("style.outputColor");
    expect(listAvailableTargetLinkedStyleProperties(simple)).toContain("style.color");
    expect(listAvailableTargetLinkedStyleProperties(simple)).not.toContain("typography.letterSpacing");
    expect(listAvailableTargetLinkedStyleProperties(structured)).not.toContain("typography.fontSize");
    expect(listAvailableTargetLinkedStyleProperties(structured)).toContain("style.bodyRowAlternateBackground");
    expect(listAvailableTargetLinkedStyleProperties(divider)).not.toContain("style.border");
    expect(addTargetLinkedStyleProperty(divider, "effect.opacity")).toMatchObject({ effect: { opacity: 1 } });
    expect(addTargetLinkedStyleProperty(divider, "effect.opacity")).not.toBe(divider);
  });
});
