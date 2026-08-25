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
  it("accepts the canonical Text namespace", () => {
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
  });

  it("rejects the legacy Textbox namespace", () => {
    expect(PowerShowElementSchema.safeParse({
      id: "textbox",
      type: "textbox",
      hidden: false,
      content: "Hello",
    }).success).toBe(false);
  });

  it("validates the canonical Container + Text composition", () => {
    expect(PowerShowElementSchema.safeParse({
      id: "box",
      type: "container",
      role: "content",
      hidden: false,
      children: [
        {
          id: "box-text",
          type: "text",
          variant: "body",
          content: "Hello",
          hidden: false,
        },
      ],
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
});
