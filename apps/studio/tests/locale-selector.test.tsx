// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocaleSelector } from "../src/features/i18n/locale-selector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { STUDIO_LOCALE_STORAGE_KEY } from "../src/features/i18n/studio-i18n";

const NON_CHROMEOS_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const CHROMEOS_USER_AGENT = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const EDGE_CHROMEOS_USER_AGENT = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const OPERA_CHROMEOS_USER_AGENT = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 OPR/105.0.0.0";
const FIREFOX_CHROMEOS_USER_AGENT = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0; rv:121.0) Gecko/20100101 Firefox/121.0";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("LocaleSelector ChromeOS compatibility", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalUserAgent = navigator.userAgent;

  function setUserAgent(userAgent: string) {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: userAgent,
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    window.localStorage.clear();
    setUserAgent(originalUserAgent);
  });

  it("keeps the native select outside ChromeOS", async () => {
    setUserAgent(NON_CHROMEOS_USER_AGENT);
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

  it("restores the canonical locale key and writes future changes canonically", async () => {
    window.localStorage.setItem(STUDIO_LOCALE_STORAGE_KEY, "pt-BR");
    await act(async () => {
      root.render(<StudioI18nProvider><LocaleSelector /></StudioI18nProvider>);
    });
    await act(async () => { await Promise.resolve(); });

    const select = container.querySelector("select");
    expect(select?.value).toBe("pt-BR");
    await act(async () => {
      if (select) {
        select.value = "en";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(window.localStorage.getItem(STUDIO_LOCALE_STORAGE_KEY)).toBe("en");
  });

  it.each([
    ["ChromeOS", CHROMEOS_USER_AGENT],
  ])("renders direct US/PT controls and applies the selected locale on %s", async (_label, userAgent) => {
    setUserAgent(userAgent);
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <LocaleSelector />
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

  it.each([
    ["Edge", EDGE_CHROMEOS_USER_AGENT],
    ["Opera", OPERA_CHROMEOS_USER_AGENT],
    ["Firefox", FIREFOX_CHROMEOS_USER_AGENT],
  ])("keeps the native select for %s on ChromeOS", async (_label, userAgent) => {
    setUserAgent(userAgent);
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
});
