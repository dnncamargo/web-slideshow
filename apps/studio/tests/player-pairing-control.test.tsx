// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimPlayerByPin: vi.fn(),
}));

vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: vi.fn(() => ({})),
  isRealtimeDatabaseConfigured: vi.fn(() => true),
}));
vi.mock("../src/features/control/player-pairing", () => ({
  claimPlayerByPin: mocks.claimPlayerByPin,
  normalizePairingPin: (value: string) => {
    const canonical = value.replace(/\s/g, "");
    return /^\d{6}$/.test(canonical) ? canonical : null;
  },
}));

import { PlayerPairingControl } from "../src/features/control/player-pairing-control";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Player pairing Control", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimPlayerByPin.mockResolvedValue({ playerUid: "player-1", ownerUid: "account-1" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("starts collapsed, opens the PIN field, and hides after successful pairing", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <PlayerPairingControl />
        </StudioI18nProvider>,
      );
    });

    expect(container.querySelector("input")).toBeNull();
    const openButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Connect Player",
    );
    expect(openButton).toBeDefined();

    act(() => openButton?.click());
    const input = container.querySelector<HTMLInputElement>("input");
    expect(input).not.toBeNull();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(input, "123 456");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const connectButton = buttons.find(
      (button) => button.textContent?.trim() === "Connect",
    );
    const closeButton = buttons.find(
      (button) => button.textContent?.trim() === "×",
    );
    expect(connectButton).toBeDefined();
    expect(closeButton).toBeDefined();
    expect(buttons.indexOf(closeButton!)).toBeGreaterThan(
      buttons.indexOf(connectButton!),
    );

    await act(async () => {
      connectButton?.click();
    });

    expect(mocks.claimPlayerByPin).toHaveBeenCalledWith({}, "123 456");
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).not.toContain("Connect Player");
  });
});
