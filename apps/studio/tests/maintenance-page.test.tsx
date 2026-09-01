// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  ref: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
}));

vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));
vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: () => ({}),
}));
vi.mock("../src/features/live/live-current-read", () => ({
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));

import { MaintenancePage } from "../src/features/control/maintenance-page";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Maintenance page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockReturnValue(vi.fn());
    mocks.subscribeLiveCurrent.mockImplementation((onState) => {
      onState({
        kind: "active",
        live: {
          publicationId: "publication-1",
          currentVersionId: "version-1",
          revision: 7,
        },
      });
      return vi.fn();
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("renders one semantic tree with Player status before Recovery", () => {
    act(() => root.render(<MaintenancePage />));

    const sections = container.querySelectorAll("main section");
    expect(sections).toHaveLength(2);
    expect(sections[0]?.querySelector("h2")?.textContent).toBe("Player status");
    expect(sections[1]?.querySelector("h2")?.textContent).toBe("Recovery");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll<HTMLButtonElement>("button")).toHaveLength(
      3,
    );
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it("keeps desktop/mobile layout CSS-driven on the same grid", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/features/control/maintenance-page.module.css"),
      "utf8",
    );

    expect(css).toContain(
      "grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr)",
    );
    expect(css).toMatch(
      /@media \(max-width: 700px\)[\s\S]*\.grid \{ grid-template-columns: 1fr; \}/,
    );
  });
});
