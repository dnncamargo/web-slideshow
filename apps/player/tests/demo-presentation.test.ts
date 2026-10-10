import { describe, expect, it } from "vitest";

import type { PresentationElement } from "@web-slideshow/document-schema";
import { renderElement, renderSlide } from "@web-slideshow/renderer";

import { displayName } from "@web-slideshow/instance-branding";
import { demoPresentation } from "../src/demo-presentation";

function collectElements(value: unknown, result: PresentationElement[] = []): PresentationElement[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectElements(item, result));
    return result;
  }

  if (value === null || typeof value !== "object") return result;

  const record = value as Record<string, unknown>;
  if (typeof record.id === "string" && typeof record.type === "string") {
    result.push(record as PresentationElement);
  }

  Object.values(record).forEach((item) => collectElements(item, result));
  return result;
}

function element(id: string): PresentationElement {
  const found = collectElements(demoPresentation).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Expected element ${id}.`);
  return found;
}

describe("canonical demo presentation", () => {
  it("imports the nine authored slides in order with schema version 1", () => {
    expect(demoPresentation.schemaVersion).toBe(1);
    expect(demoPresentation.id).toBe("presentation-mv1oi2rv-8qovqq");
    expect(demoPresentation.slides).toHaveLength(9);
    expect(demoPresentation.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4",
      "slide-5",
      "slide-6",
      "slide",
      "slide-7",
      "slide-8",
    ]);
    expect(demoPresentation.slides.map((slide) => slide.title)).toEqual([
      "Visual primitives",
      "Typography",
      "Text and content",
      "Code",
      "Terminal",
      "Table",
      "Scripted",
      "Images",
      "Plot and interaction",
    ]);
  });

  it("keeps the root hierarchy neutral and isolates the Scripted container", () => {
    for (const slide of demoPresentation.slides) {
      expect(slide.elements).toHaveLength(1);
      const root = slide.elements[0];
      expect(root?.type).toBe("container");
      if (root?.type !== "container") continue;

      expect(root.layout).toBeUndefined();
      expect(root.style).toBeUndefined();
      expect(root.children[0]?.type).toBe("container");
      if (root.children[0]?.type === "container") {
        expect(root.children[0].style?.background).toBeDefined();
      }
    }

    const scriptedRoot = demoPresentation.slides[6]?.elements[0];
    expect(scriptedRoot?.type).toBe("container");
    if (scriptedRoot?.type !== "container") return;
    expect(scriptedRoot.children.map((child) => child.id)).toEqual([
      "container-element-2",
    ]);
    expect(scriptedRoot.children[0]?.type).toBe("container");
    expect(collectElements(scriptedRoot).some((candidate) => candidate.type === "plot")).toBe(false);
  });

  it("keeps every authored and nested structural ID unique", () => {
    const ids = collectElements(demoPresentation).map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders each slide with only its own element DOM", () => {
    for (const slide of demoPresentation.slides) {
      const html = renderSlide(slide, { presentation: demoPresentation });
      expect(html).toContain(`data-presentation-slide-id="${slide.id}"`);
      expect(html).toContain(`data-presentation-id="${slide.elements[0]?.id}"`);

      for (const otherSlide of demoPresentation.slides) {
        if (otherSlide.id === slide.id) continue;
        for (const candidate of collectElements(otherSlide)) {
          expect(html).not.toContain(`data-presentation-id="${candidate.id}"`);
        }
      }
    }
  });

  it("resolves all intentional displayName placeholders from instance configuration", () => {
    expect(demoPresentation.title).toBe(`${displayName} Component Showcase`);
    expect(demoPresentation.description).toBe(`Visual validation of ${displayName} renderer and theme components.`);

    const firstSlideTitle = element("text-1");
    expect(firstSlideTitle.type).toBe("text");
    if (firstSlideTitle.type === "text") expect(firstSlideTitle.content).toBe(displayName);

    const terminal = element("terminal-1");
    expect(terminal.type).toBe("terminal");
    if (terminal.type === "terminal") {
      expect(terminal.title).toBe(displayName);
      expect(terminal.lines[1]?.content).toBe(`${displayName} Player running`);
    }

    for (const [id, fit] of [["image-1", "contain"], ["image-2", "cover"], ["image-3", "fill"]] as const) {
      const image = element(id);
      expect(image.type).toBe("image");
      if (image.type === "image") {
        expect(image.alt).toBe(`${displayName} demo graphic using ${fit}`);
      }
    }
  });

  it("preserves the authored Scripted circuit and its port contract", () => {
    const scripted = element("scripted-element");
    expect(scripted.type).toBe("scripted");
    if (scripted.type !== "scripted") return;

    expect(scripted.title).toBe("Scripted content");
    expect(scripted.html).toContain("id=\"switchControl\"");
    expect(scripted.html).toContain("id=\"electrons\"");
    expect(scripted.css).toContain("#switchControl:focus-visible");
    expect(scripted.script).toContain("requestAnimationFrame(animate)");
    expect(scripted.script).toContain("applyVoltage");
    expect(scripted.script).toContain("applyResistance");
    expect(scripted.script).toContain("applySwitch");
    expect(scripted.ports).toEqual([
      { id: "chave", label: "Chave", kind: "boolean", direction: "input-output" },
      { id: "resistencia", label: "Resistencia", kind: "number", direction: "input-output", min: 1, max: 1000 },
      { id: "tensao", label: "Tensão", kind: "number", direction: "input", min: 1, max: 240, step: 1 },
    ]);

    const rendered = renderElement(scripted);
    expect(rendered).toContain('sandbox="allow-scripts"');
    expect(rendered).toContain("switchControl");
  });

  it("preserves structured Table content and authored Image fit settings", () => {
    const table = element("table-element-copy-2");
    expect(table.type).toBe("table");
    if (table.type === "table") {
      expect(table.mode).toBe("structured");
      expect(table.columns).toHaveLength(3);
      expect(table.rows).toHaveLength(4);
      const firstColumn = table.columns[0];
      expect(firstColumn !== undefined && "header" in firstColumn).toBe(true);
      if (firstColumn !== undefined && "header" in firstColumn) {
        expect(firstColumn.header.children[0]).toMatchObject({
          type: "text",
          content: "Component",
          variant: "system:table-column-header",
        });
      }
    }

    for (const [id, fit] of [["image-1", "contain"], ["image-2", "cover"], ["image-3", "fill"] as const]) {
      const image = element(id);
      expect(image.type).toBe("image");
      if (image.type === "image") {
        expect(image.fit).toBe(fit);
        expect("src" in image && image.src).toContain("plus.unsplash.com");
      }
    }
  });

  it("preserves all authored animated Plot configurations", () => {
    const plots = collectElements(demoPresentation).filter(
      (candidate): candidate is Extract<PresentationElement, { type: "plot" }> =>
        candidate.type === "plot" && candidate.animation !== undefined,
    );

    expect(plots).toHaveLength(4);
    expect(plots.map((plot) => plot.id)).toEqual([
      "plot-element-2",
      "plot-element-2-copy",
      "plot-element-2-copy-2",
      "plot-element",
    ]);
    expect(plots.slice(0, 3).map((plot) => plot.fitToAxes)).toEqual([false, false, false]);
    expect(plots[3]?.fitToAxes).toBe(true);
    expect(plots.every((plot) => plot.animation?.parameter === "t")).toBe(true);
    expect(plots.every((plot) => plot.animation?.durationMs === 4000)).toBe(true);
  });
});
