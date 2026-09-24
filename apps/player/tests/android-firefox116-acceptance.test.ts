// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  materializeSlide,
  PresentationSchema,
  visitSlideElements,
  type Presentation,
} from "@web-slideshow/document-schema";

const firebase = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(),
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("firebase/app", () => firebase);
vi.mock("firebase/firestore/lite", () => ({
  getFirestore: firebase.getFirestore,
  doc: firebase.doc,
  getDoc: firebase.getDoc,
}));

import { loadPublishedPresentation } from "../src/published-presentation-loader";
import { mountPlayer } from "../src/player";

/**
 * Focused release-gate harness for the Android interactive display target.
 *
 * It intentionally uses the Player's existing Vitest/jsdom infrastructure:
 * the published loader is stubbed at the Firestore boundary, then the real
 * Player and document-schema materializer are exercised together.
 */

function acceptancePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "android-firefox116-acceptance",
    title: "Android Firefox 116 acceptance",
    description: "",
    aspectRatio: "16:9",
    textStyles: [{
      id: "android-heading",
      name: "Android heading",
      role: "title",
      typography: { fontSize: 28, fontWeight: 700 },
      style: { color: "#f8fafc" },
    }],
    linkedStyles: [{
      id: "master-panel",
      name: "Master panel",
      layout: { padding: 12 },
      style: { background: { color: "#172554" } },
    }, {
      id: "local-panel",
      name: "Local panel",
      layout: { padding: 8 },
      style: { background: { color: "#14532d" } },
    }],
    rootDefinitions: [{
      id: "android-root",
      name: "Android root",
      root: {
        id: "android-root-container",
        type: "container",
        children: [{
          id: "master-panel-element",
          type: "container",
          linkedStyleId: "master-panel",
          children: [{
            id: "master-heading",
            type: "text",
            variant: "android-heading",
            content: "Master content",
          }],
        }, {
          id: "local-target",
          type: "container",
          children: [],
        }],
      },
      localChildTargetIds: ["local-target"],
    }],
    slides: [{
      id: "root-slide",
      rootDefinitionId: "android-root",
      elements: [],
      localRootChildren: [{
        targetContainerId: "local-target",
        children: [{
          id: "local-panel-element",
          type: "container",
          linkedStyleId: "local-panel",
          children: [{
            id: "local-heading",
            type: "text",
            variant: "android-heading",
            content: "Local content",
          }],
        }],
      }],
    }, {
      id: "offline-slide",
      elements: [{
        id: "offline-heading",
        type: "text",
        variant: "android-heading",
        content: "Offline continuity",
      }],
    }],
  });
}

function versionDocument(presentation: Presentation) {
  return {
    exists: () => true,
    data: () => ({
      presentationId: presentation.id,
      presentationJson: JSON.stringify(presentation),
    }),
  };
}

function installPublishedRead(presentation: Presentation): void {
  firebase.getApps.mockReturnValue([]);
  firebase.initializeApp.mockReturnValue({ name: "acceptance" });
  firebase.getFirestore.mockReturnValue({});
  firebase.doc
    .mockReturnValueOnce({ path: "publishedPresentations/publication-1" })
    .mockReturnValueOnce({ path: "publishedPresentations/publication-1/versions/version-1" });
  firebase.getDoc
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ currentVersionId: "version-1" }),
    })
    .mockResolvedValueOnce(versionDocument(presentation));
}

function setFirebaseEnvironment(): void {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "acceptance");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "acceptance.example");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "acceptance");
}

describe("Android interactive display — Firefox 116 release gate", () => {
  let root: HTMLElement;
  let originalMatchMedia: PropertyDescriptor | undefined;
  let originalAnimate: PropertyDescriptor | undefined;

  beforeEach(() => {
    setFirebaseEnvironment();
    document.body.innerHTML = `<main id="player-root"></main>`;
    root = document.querySelector<HTMLElement>("#player-root")!;
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else Reflect.deleteProperty(window, "matchMedia");
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
    document.body.replaceChildren();
  });

  it("loads the published version, materializes Root-backed master/local content, and preserves style references", async () => {
    const presentation = acceptancePresentation();
    installPublishedRead(presentation);

    const loaded = await loadPublishedPresentation("publication-1");
    expect(loaded.kind).toBe("ok");
    if (loaded.kind !== "ok") return;

    const canonical = loaded.presentation.slides[0]!;
    const materialized = materializeSlide(loaded.presentation, canonical).slide;
    expect(materialized.elements.map((element) => element.id)).toEqual(["android-root-container"]);
    const materializedIds = new Map<string, Presentation["slides"][number]["elements"][number]>();
    visitSlideElements(materialized, (element) => materializedIds.set(element.id, element));
    expect(materializedIds.get("master-panel-element")).toMatchObject({ linkedStyleId: "master-panel" });
    expect(materializedIds.get("local-panel-element")).toMatchObject({ linkedStyleId: "local-panel" });
    expect(loaded.presentation.linkedStyles?.map((style) => style.id)).toEqual([
      "master-panel",
      "local-panel",
    ]);
    expect(loaded.presentation.textStyles?.[0]?.id).toBe("android-heading");

    const player = mountPlayer(root, loaded.presentation, { transition: "none" });
    expect(root.textContent).toContain("Master content");
    expect(root.textContent).toContain("Local content");
    expect(root.innerHTML).toContain("padding:12px");
    expect(root.innerHTML).toContain("background:#172554");
    expect(root.innerHTML).toContain("font-size:28px");
    expect(root.querySelector('[data-presentation-id="master-heading"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-id="local-heading"]')).not.toBeNull();
    player.destroy();
  });

  it("keeps slide navigation local during a temporary network loss", async () => {
    const presentation = acceptancePresentation();
    installPublishedRead(presentation);
    const loaded = await loadPublishedPresentation("publication-1");
    expect(loaded.kind).toBe("ok");
    if (loaded.kind !== "ok") return;

    const player = mountPlayer(root, loaded.presentation, { transition: "none" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    firebase.getDoc.mockRejectedValue(new Error("temporary offline"));

    player.next();
    expect(player.getCurrentIndex()).toBe(1);
    expect(root.textContent).toContain("Offline continuity");
    player.previous();
    expect(player.getCurrentIndex()).toBe(0);
    expect(root.textContent).toContain("Master content");
    expect(firebase.getDoc).toHaveBeenCalledTimes(2);
    player.destroy();
  });

  it("remains usable with Firefox 116-era optional runtime APIs unavailable", async () => {
    const presentation = acceptancePresentation();
    const player = mountPlayer(root, presentation, { transition: "fade" });
    Reflect.deleteProperty(window, "matchMedia");
    Reflect.deleteProperty(HTMLElement.prototype, "animate");

    expect(() => player.next()).not.toThrow();
    expect(player.getCurrentIndex()).toBe(1);
    expect(root.textContent).toContain("Offline continuity");
    expect(() => player.previous()).not.toThrow();
    expect(player.getCurrentIndex()).toBe(0);
    player.destroy();
  });
});
