import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustomLibraryStylePreview } from "../src/features/custom-library/custom-library-style-preview";
import { CustomLibraryBrowser } from "../src/features/custom-library/custom-library-browser";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { CustomLibraryElementRecipe } from "../src/features/custom-library/custom-library-recipe";

function recipe(
  type: CustomLibraryElementRecipe["type"],
  properties: Array<{ path: string; value: unknown }> = [],
  children?: CustomLibraryElementRecipe[],
): CustomLibraryElementRecipe {
  return { type, properties, ...(children ? { children } : {}) };
}

function markup(input: CustomLibraryElementRecipe): string {
  return renderToStaticMarkup(<CustomLibraryStylePreview recipe={input} />);
}

describe("CustomLibraryStylePreview", () => {
  it("renders fixed text instead of saved content", () => {
    const html = markup(recipe("text", [{ path: "content", value: "Secret content" }]));
    expect(html).toContain(">Aa</span>");
    expect(html).not.toContain("Secret content");
  });

  it("reflects safe text typography and atomic stroke", () => {
    const html = markup(recipe("text", [
      { path: "content", value: "ignored" },
      { path: "typography.fontFamily", value: "Montserrat" },
      { path: "typography.fontWeight", value: 900 },
      { path: "typography.textTransform", value: "uppercase" },
      { path: "typography.textStroke", value: { width: 2, color: "#000000" } },
    ]));
    expect(html).toContain("font-family:&quot;Montserrat&quot;");
    expect(html).toContain("font-weight:900");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("-webkit-text-stroke:2px #000000");
  });

  it("clamps font size and stroke width", () => {
    const html = markup(recipe("text", [
      { path: "typography.fontSize", value: 100 },
      { path: "typography.textStroke", value: { width: 20, color: "#fff" } },
    ]));
    expect(html).toContain("font-size:32px");
    expect(html).toContain("-webkit-text-stroke:4px #ffffff");
  });

  it("ignores malformed and descendant-only supported values safely", () => {
    expect(() => markup(recipe("text", [
      { path: "typography.fontSize", value: "url(javascript:alert(1))" },
      { path: "typography.textStroke.width", value: 3 },
      { path: "typography.textStroke.color", value: "#000" },
      { path: "style.color", value: "red; background-image: url(https://evil.test)" },
    ]))).not.toThrow();
    const html = markup(recipe("text", [
      { path: "typography.textStroke.width", value: 3 },
      { path: "typography.textStroke.color", value: "#000" },
    ]));
    expect(html).not.toContain("text-stroke");
  });

  it("uses container color, border, radius, shadow, and opacity without children", () => {
    const html = markup(recipe("container", [
      { path: "style.background.color", value: "#112233" },
      { path: "style.border", value: { width: 2, style: "dashed", color: "#ffffff" } },
      { path: "style.borderRadius", value: "2rem" },
      { path: "effect.shadow", value: { x: 2, y: 3, blur: 4, color: "#000000" } },
      { path: "effect.opacity", value: 0.5 },
    ], [recipe("text", [{ path: "content", value: "not rendered" }])]));
    expect(html).toContain("background-color:#112233");
    expect(html).toContain("border:2px dashed #ffffff");
    expect(html).toContain("border-radius:18px");
    expect(html).toContain("box-shadow:2px 3px 4px 0px #000000");
    expect(html).toContain("opacity:0.5");
    expect(html).not.toContain("not rendered");
  });

  it("never injects hostile image, embed, or scripted payloads", () => {
    const hostile = [
      { path: "src", value: "https://evil.test/image.png" },
      { path: "url", value: "https://evil.test" },
      { path: "html", value: "<script>alert(1)</script>" },
      { path: "css", value: "body { background: url(https://evil.test) }" },
      { path: "script", value: "alert(1)" },
    ];
    for (const type of ["image", "embed", "scripted"] as const) {
      const html = markup(recipe(type, hostile));
      expect(html).not.toContain("evil.test");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("background-image");
    }
  });

  it.each([
    "image", "gallery", "code", "terminal", "table", "chart", "interactive",
    "divider", "embed", "blocks", "scripted", "topics", "container",
  ] as const)("renders a safe fixed silhouette for %s", (type) => {
    expect(markup(recipe(type))).toContain(`data-preview-type=\"${type}\"`);
  });

  it("keeps the preview hidden and noninteractive", () => {
    const html = markup(recipe("text"));
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
  });

  it("keeps browser row metadata, order, selection, and one preview per style", () => {
    const html = renderToStaticMarkup(
      <StudioI18nProvider>
        <CustomLibraryBrowser
          selectedId="style-2"
          onSelect={() => undefined}
          items={[
            { id: "style-1", item: { name: "First style", root: recipe("text"), description: "First description" } },
            { id: "style-2", item: { name: "Second style", root: recipe("container"), description: "Second description" } },
          ]}
        />
      </StudioI18nProvider>,
    );
    expect((html.match(/data-custom-library-preview/g) ?? []).length).toBe(2);
    expect(html.indexOf("First style")).toBeLessThan(html.indexOf("Second style"));
    expect(html).toContain("First description");
    expect(html).toContain("Second description");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("data-custom-library-row");
  });
});
