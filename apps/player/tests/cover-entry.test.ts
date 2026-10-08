// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  loadPublishedOwnerUid: vi.fn(),
  resolveLiveMount: vi.fn(),
  loadPublishedVersion: vi.fn(),
  mountProjectionSurface: vi.fn(),
}));

vi.mock("../src/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/live-entry", () => ({ resolveLiveMount: mocks.resolveLiveMount }));
vi.mock("../src/published-presentation-loader", () => ({
  loadPublishedOwnerUid: mocks.loadPublishedOwnerUid,
  loadPublishedVersion: mocks.loadPublishedVersion,
}));
vi.mock("../src/projection-surface", () => ({ mountProjectionSurface: mocks.mountProjectionSurface }));

import { startCover } from "../src/cover-entry";

describe("Player cover runtime", () => {
  let root: HTMLElement;
  const presentation = { slides: [{ id: "cover" }, { id: "second" }] };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector("#app")!;
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.loadPublishedOwnerUid.mockResolvedValue("owner-a");
    window.history.replaceState({}, "", "/cover?publication=publication-1");
    mocks.mountProjectionSurface.mockReturnValue({ destroy: vi.fn() });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/cover");
    vi.clearAllMocks();
  });

  it("resolves the active exact version once and mounts the projection at its first slide", async () => {
    mocks.resolveLiveMount.mockResolvedValue({ kind: "ok", presentation, publicationId: "publication-1" });
    startCover(root);
    await vi.waitFor(() => expect(mocks.mountProjectionSurface).toHaveBeenCalled());

    expect(mocks.resolveLiveMount).toHaveBeenCalledWith({}, "owner-a", mocks.loadPublishedVersion);
    expect(mocks.mountProjectionSurface).toHaveBeenCalledWith(root, presentation, {
      transition: "none",
      animatePlots: false,
      animateShapes: false,
    });
    expect(root.querySelector(".player-controls")).toBeNull();
  });

  it("keeps unavailable and error states safe without projection or writes", async () => {
    mocks.resolveLiveMount.mockResolvedValue({ kind: "error" });
    startCover(root);
    await vi.waitFor(() => expect(root.textContent).toContain("Não foi possível carregar"));
    expect(root.textContent).toContain("Não foi possível carregar");
    expect(mocks.mountProjectionSurface).not.toHaveBeenCalled();
  });

  it("does not select an arbitrary account Live without a publication query", async () => {
    window.history.replaceState({}, "", "/cover");
    startCover(root);
    await vi.waitFor(() => expect(root.textContent).toContain("Nenhuma apresentação ao vivo"));

    expect(mocks.loadPublishedOwnerUid).not.toHaveBeenCalled();
    expect(mocks.resolveLiveMount).not.toHaveBeenCalled();
    expect(mocks.mountProjectionSurface).not.toHaveBeenCalled();
  });

  it("destroys the mounted projection on pagehide", async () => {
    const projection = { destroy: vi.fn() };
    mocks.mountProjectionSurface.mockReturnValue(projection);
    mocks.resolveLiveMount.mockResolvedValue({ kind: "ok", presentation, publicationId: "publication-1" });
    startCover(root);
    await vi.waitFor(() => expect(mocks.mountProjectionSurface).toHaveBeenCalled());
    window.dispatchEvent(new Event("pagehide"));
    expect(projection.destroy).toHaveBeenCalledTimes(1);
  });
});
