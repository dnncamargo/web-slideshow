// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocaleSelector } from "../src/features/i18n/locale-selector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("LocaleSelector ChromeOS compatibility", () => {
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
    window.localStorage.clear();
  });

  it("keeps the native select by default", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <LocaleSelector />
        </StudioI18nProvider>,
      );
    });

    expect(container.querySelector("select")).not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders direct US/PT controls and applies the selected locale in compatibility mode", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <LocaleSelector chromeOsNativeSelectCompat />
        </StudioI18nProvider>,
      );
    });

    expect(container.querySelector("select")).toBeNull();
    const options = Array.from(container.querySelectorAll("button"));
    expect(options.map((button) => button.textContent?.trim())).toEqual(["US", "PT"]);
    expect(options[0]?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      options[1]?.click();
    });

    expect(options[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(options[0]?.getAttribute("aria-pressed")).toBe("false");
  });
});
