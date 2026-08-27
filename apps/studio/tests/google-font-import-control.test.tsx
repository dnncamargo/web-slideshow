// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FontFaceResource } from "@powershow/document-schema";
import { GoogleFontImportControl } from "../src/features/fonts/components/google-font-import-control";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function resolvedFace(weight: number) {
  return {
    weight,
    style: "normal" as const,
    subset: "latin",
    source: {
      type: "url" as const,
      url: `https://fonts.example.test/example-${weight}.woff2`,
      format: "woff2" as const,
    },
  };
}

describe("GoogleFontImportControl selected variants", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("continues past an unselected middle variant", async () => {
    const onAddFontFace = vi.fn(
      async (...args: [string, FontFaceResource]) => {
        void args;
        return true;
      },
    );
    const onFontAdded = vi.fn();
    const result = {
      families: [
        {
          family: "Example",
          variants: [
            { weight: 400, style: "normal" as const, faces: [resolvedFace(400)] },
            { weight: 500, style: "normal" as const, faces: [resolvedFace(500)] },
            { weight: 700, style: "normal" as const, faces: [resolvedFace(700)] },
          ],
        },
      ],
      unsupported: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true, result })),
    );

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <GoogleFontImportControl
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onFontAdded={onFontAdded}
            controlPrefix="google-test"
          />
        </StudioI18nProvider>,
      );
    });

    const urlInput = container.querySelector<HTMLInputElement>(
      "#google-test-google-import-url",
    );
    if (!urlInput) throw new Error("Google Fonts URL input not found");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(urlInput, "https://fonts.googleapis.com/css2?family=Example");
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Resolve")
        ?.click();
      await Promise.resolve();
    });

    const middleVariant = container.querySelector<HTMLInputElement>(
      "#google-test-google-import-variant-0-1",
    );
    if (!middleVariant) throw new Error("middle variant checkbox not found");

    await act(async () => {
      middleVariant.click();
    });

    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Add selected")
        ?.click();
      await Promise.resolve();
    });

    expect(onAddFontFace.mock.calls.map(([, face]) => face.weight)).toEqual([
      400,
      700,
    ]);
    expect(onFontAdded).toHaveBeenCalledWith("Example");
  });
});
