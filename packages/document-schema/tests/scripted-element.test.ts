import { describe, expect, it } from "vitest";

import {
  EmbedElementSchema,
  PowerShowElementSchema,
  ScriptedElementSchema,
  TextElementSchema,
} from "../src/elements";

import {
  PresentationSchema,
  SlideSchema,
} from "../src";

import {
  validPresentation,
} from "./fixtures/valid-presentation";

function scripted(overrides: Record<string, unknown> = {}) {
  return {
    id: "scripted-1",

    type: "scripted",

    hidden: false,

    ...overrides,
  };
}

describe("Scripted element schema", () => {
  it("parses a minimal Scripted element", () => {
    const result = ScriptedElementSchema.safeParse(scripted());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("scripted");

      expect(result.data.id).toBe("scripted-1");
    }
  });

  it("defaults title to Scripted content", () => {
    const result = ScriptedElementSchema.safeParse(scripted());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe("Scripted content");
    }
  });

  it("preserves an explicit non-empty title", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({ title: "PWM demonstration" }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe("PWM demonstration");
    }
  });

  it("defaults html, css, and script to empty strings", () => {
    const result = ScriptedElementSchema.safeParse(scripted());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.html).toBe("");

      expect(result.data.css).toBe("");

      expect(result.data.script).toBe("");
    }
  });

  it("preserves explicit html, css, and script exactly", () => {
    const html =
      '<div class="demo" data-count="1">\n  <span>Hello</span>\n</div>';

    const css =
      ".demo {\n  display: flex;\n  gap: 8px;\n}\n";

    const script =
      'function tick() {\n  console.log("tick");\n}\n\ntick();';

    const result = ScriptedElementSchema.safeParse(
      scripted({ html, css, script }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.html).toBe(html);

      expect(result.data.css).toBe(css);

      expect(result.data.script).toBe(script);
    }
  });

  it("follows normal hidden and style element behavior", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({
        hidden: true,

        style: {
          opacity: 0.75,
          className: "scripted-stage",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.hidden).toBe(true);

      expect(result.data.style).toEqual({
        opacity: 0.75,
        className: "scripted-stage",
      });
    }
  });

  it("defaults hidden to false like other elements", () => {
    const result = ScriptedElementSchema.safeParse({
      id: "scripted-2",
      type: "scripted",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.hidden).toBe(false);
    }
  });

  it("rejects invalid style like other elements", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({
        style: {
          opacity: 2,
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("strips unknown sandbox and permission configuration fields", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({
        sandbox: "allow-scripts",
        permissions: ["camera"],
        allowSameOrigin: true,
        allowNetwork: true,
        allowForms: true,
        allowPopups: true,
        allowStorage: true,
        runtime: "worker",
        provider: "unknown",
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).not.toHaveProperty("sandbox");

      expect(result.data).not.toHaveProperty("permissions");

      expect(result.data).not.toHaveProperty("allowSameOrigin");

      expect(result.data).not.toHaveProperty("allowNetwork");

      expect(result.data).not.toHaveProperty("allowForms");

      expect(result.data).not.toHaveProperty("allowPopups");

      expect(result.data).not.toHaveProperty("allowStorage");

      expect(result.data).not.toHaveProperty("runtime");

      expect(result.data).not.toHaveProperty("provider");
    }
  });

  it("accepts Scripted through PowerShowElementSchema", () => {
    const result = PowerShowElementSchema.safeParse(scripted());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("scripted");
    }
  });

  it("accepts Scripted as a Slide element", () => {
    const result = SlideSchema.safeParse({
      id: "slide-1",

      elements: [
        scripted({
          id: "slide-scripted",

          html: "<strong>slide</strong>",
        }),
      ],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.elements[0]).toMatchObject({
        type: "scripted",
        id: "slide-scripted",
        html: "<strong>slide</strong>",
      });
    }
  });

  it("accepts Scripted inside Container recursion", () => {
    const result = PowerShowElementSchema.safeParse({
      id: "outer-container",

      type: "container",

      layout: { children: { direction: "column" } },

      hidden: false,

      children: [
        {
          id: "inner-container",

          type: "container",

          layout: { children: { direction: "row" } },

          hidden: false,

          children: [
            scripted({
              id: "nested-scripted",

              css: ".nested { color: teal; }",
            }),
          ],
        },
      ],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "container",
        children: [
          {
            type: "container",
            children: [
              {
                type: "scripted",
                id: "nested-scripted",
                css: ".nested { color: teal; }",
              },
            ],
          },
        ],
      });
    }
  });

  it("rejects an empty title", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({ title: "" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a non-string title", () => {
    const result = ScriptedElementSchema.safeParse(
      scripted({ title: 42 }),
    );

    expect(result.success).toBe(false);
  });

  it("leaves existing documents and elements valid", () => {
    const documentResult =
      PresentationSchema.safeParse(
        validPresentation,
      );

    expect(documentResult.success).toBe(true);

    const textResult =
      TextElementSchema.safeParse({
        id: "text-1",

        type: "text",

        variant: "body",

        content: "PowerShow",

        hidden: false,
      });

    expect(textResult.success).toBe(true);
  });

  it("roundtrips Scripted through JSON serialization", () => {
    const source = ScriptedElementSchema.parse(
      scripted({
        html: "<p>static</p>",
        css: "p { margin: 0; }",
        script: "window.__demo = true;",
      }),
    );

    const restored = ScriptedElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });

  it("leaves existing EmbedElement parsing unchanged", () => {
    const result = EmbedElementSchema.safeParse({
      id: "embed-1",

      type: "embed",

      hidden: false,

      src: "https://example.com/",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("embed");

      expect(result.data).not.toHaveProperty("script");
    }
  });
});
