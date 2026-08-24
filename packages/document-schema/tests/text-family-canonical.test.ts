import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";

const typography = {
  fontFamily: "Inter",
  fontSize: 24,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  textStroke: { width: 1, color: "#ffffff" },
};

const visualStyle = {
  color: "#ffffff",
  background: { color: "#111827", gradient: { type: "linear" as const, stops: [{ color: "#111827", position: 0 }, { color: "#1d4ed8", position: 100 }] } },
  borderRadius: 8,
  className: "hero-copy",
};

describe("Text family canonical contract", () => {
  it("accepts canonical Text and Textbox namespaces", () => {
    expect(PowerShowElementSchema.safeParse({
      id: "text",
      type: "text",
      hidden: false,
      content: "Hello",
      layout: { position: "absolute", top: 10, right: "5%" },
      style: visualStyle,
      typography,
      effect: { opacity: 0.8, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
      link: { kind: "url", href: "https://example.com" },
    }).success).toBe(true);

    expect(PowerShowElementSchema.safeParse({
      id: "textbox",
      type: "textbox",
      hidden: false,
      content: "Hello",
      layout: { width: "50%", height: 120 },
      style: visualStyle,
      typography,
      effect: { opacity: 1 },
    }).success).toBe(true);
  });

  it("rejects legacy and accidental Text properties", () => {
    const base = { id: "text", type: "text", hidden: false, content: "Hello" };
    for (const input of [
      { ...base, layout: { width: 100 } },
      { ...base, style: { fontSize: 20 } },
      { ...base, style: { opacity: 0.5 } },
      { ...base, style: { placement: { mode: "absolute" } } },
      { ...base, style: { background: { pattern: { image: "radial-gradient(#000000 1px, transparent 1px)" } } } },
    ]) {
      expect(PowerShowElementSchema.safeParse(input).success).toBe(false);
    }
  });

  it("rejects legacy Textbox addresses while retaining canonical size", () => {
    const base = { id: "textbox", type: "textbox", hidden: false, content: "Hello" };
    expect(PowerShowElementSchema.safeParse({ ...base, layout: { width: 100, height: 40 } }).success).toBe(true);
    expect(PowerShowElementSchema.safeParse({ ...base, style: { width: 100 } }).success).toBe(false);
    expect(PowerShowElementSchema.safeParse({ ...base, style: { fontWeight: 700 } }).success).toBe(false);
  });
});
