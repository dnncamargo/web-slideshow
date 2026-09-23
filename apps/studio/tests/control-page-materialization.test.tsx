// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, materializeSlide, type Presentation, visitSlideElements } from "@web-slideshow/document-schema";

const mocks = vi.hoisted(() => ({
  gallery: vi.fn(), plot: vi.fn(), action: vi.fn(), state: vi.fn(), presenter: vi.fn(),
  presentationState: null as unknown,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../src/features/i18n/studio-i18n-context", () => ({ useStudioI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../src/features/control/realtime-db", () => ({ isRealtimeDatabaseConfigured: () => true }));
vi.mock("../src/features/control/use-live-session-control", () => ({
  useLiveSessionControl: () => ({
    liveState: { kind: "active", live: { publicationId: "publication", currentVersionId: "version", revision: 3 } },
    view: { enabled: true, desiredPageId: "page-a", actualPageId: "page-a", status: { kind: "synced" } },
    sendFailed: false, promotingVersionId: null, failedPromotionVersionId: null,
    previous: vi.fn(), next: vi.fn(), goTo: vi.fn(), followPlayer: vi.fn(), updatePlayer: vi.fn(), requestFullscreen: vi.fn(),
  }),
}));
vi.mock("../src/features/control/presenter/use-presenter-presentation", () => ({
  usePresenterPresentation: () => mocks.presentationState,
  resolveLivePageId: vi.fn(),
}));
vi.mock("../src/features/control/use-live-gallery-control", () => ({ useLiveGalleryControl: (options: unknown) => { mocks.gallery(options); return { galleries: [], sendFailed: false, nextGallery: vi.fn(), setGalleryExpanded: vi.fn() }; } }));
vi.mock("../src/features/control/use-live-plot-animation-control", () => ({ useLivePlotAnimationControl: (options: unknown) => { mocks.plot(options); return { plotTargets: [], actionsEnabled: false, pendingPlotSlots: new Set(), sendFailed: false, triggerAction: vi.fn(), triggerAll: vi.fn() }; } }));
vi.mock("../src/features/control/use-live-scripted-action-control", () => ({ useLiveScriptedActionControl: (options: unknown) => { mocks.action(options); return { groups: [], actionsEnabled: false, sendFailed: false, triggerAction: vi.fn() }; } }));
vi.mock("../src/features/control/use-live-scripted-state-control", () => ({ useLiveScriptedStateControl: (options: unknown) => { mocks.state(options); return { groups: [], controlsEnabled: false, sendFailed: false, setPortValue: vi.fn() }; } }));
vi.mock("../src/features/control/use-live-slide-transition-control", () => ({ useLiveSlideTransitionControl: () => ({ transition: "fade", setTransition: vi.fn(), writeInFlight: false, sendFailed: false }) }));
vi.mock("../src/features/control/use-live-player-controls-control", () => ({ useLivePlayerControlsControl: () => ({ controls: { position: "bottom-right", style: "compact", showCounter: true, animation: "fade" }, setControlsOptions: vi.fn(), writeInFlight: false, sendFailed: false }) }));
vi.mock("../src/features/control/presenter/presenter-view", () => ({ PresenterView: (props: unknown) => { mocks.presenter(props); return <div data-presenter-view />; } }));

import { ControlPage } from "../src/features/control/control-page";

function rootPresentation(masterId: string, pageId = "page-a"): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1, id: `presentation-${masterId}`, title: "Presentation",
    rootDefinitions: [{
      id: `${masterId}-root`, name: masterId,
      root: { id: `${masterId}-container`, type: "container", children: [
        { id: `${masterId}-gallery`, type: "gallery", items: [{ src: "/a.png" }, { src: "/b.png" }] },
        { id: `${masterId}-plot`, type: "plot", source: "y = sin(x)", animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 } },
        { id: `${masterId}-script`, type: "scripted", title: "Master script", html: "", css: "", script: "", ports: [{ id: `${masterId}-action`, label: "Run", kind: "action" }] },
        { id: `${masterId}-target`, type: "container", children: [] },
      ] },
      localChildTargetIds: [`${masterId}-target`],
    }],
    defaultRootDefinitionId: `${masterId}-root`,
    slides: [{ id: pageId, elements: [], localRootChildren: [{ targetContainerId: `${masterId}-target`, children: [
      { id: `${masterId}-local-gallery`, type: "gallery", items: [{ src: "/local.png" }] },
      { id: `${masterId}-local-script`, type: "scripted", title: "Local script", html: "", css: "", script: "", ports: [{ id: `${masterId}-local-action`, label: "Local run", kind: "action" }] },
    ] }] }],
  });
}

describe("ControlPage Root Definition projection boundary", () => {
  let root: Root;
  let node: HTMLDivElement;

  beforeEach(() => {
    node = document.createElement("div"); document.body.appendChild(node); root = createRoot(node);
    const livePresentation = rootPresentation("live-master");
    const stagedPresentation = rootPresentation("staged-master");
    mocks.presentationState = { kind: "ready", presentation: stagedPresentation, livePresentation, displayIndex: 0, pendingVersion: null };
    mocks.gallery.mockClear(); mocks.plot.mockClear(); mocks.action.mockClear(); mocks.state.mockClear(); mocks.presenter.mockClear();
    act(() => root.render(<ControlPage />));
  });

  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  it("passes one memoized effective live Slide to all runtime discovery hooks", () => {
    const gallery = mocks.gallery.mock.calls[0]?.[0];
    const plot = mocks.plot.mock.calls[0]?.[0];
    const action = mocks.action.mock.calls[0]?.[0];
    const state = mocks.state.mock.calls[0]?.[0];
    const livePresentation = (mocks.presentationState as { livePresentation: Presentation }).livePresentation;
    const liveBefore = structuredClone(livePresentation);
    expect(gallery.effectiveSlide).toBe(plot.effectiveSlide);
    expect(gallery.effectiveSlide).toBe(action.effectiveSlide);
    expect(gallery.effectiveSlide).toBe(state.effectiveSlide);
    expect(gallery.effectiveSlide.elements).toEqual(expect.any(Array));
    const ids: string[] = [];
    visitSlideElements(gallery.effectiveSlide, (element) => ids.push(element.id));
    expect(ids).toContain("live-master-gallery");
    expect(ids).toContain("live-master-script");
    expect(ids).toContain("live-master-local-gallery");
    expect(ids).toContain("live-master-local-script");
    expect(livePresentation.slides[0]?.elements).toEqual([]);
    expect(livePresentation).toEqual(liveBefore);
    expect(ids).not.toContain("staged-master-gallery");
    expect(gallery.desiredPageId).toBe("page-a");
    const presenterState = (mocks.presenter.mock.calls[0]?.[0] as { presentationState: { presentation: Presentation; livePresentation: Presentation } }).presentationState;
    expect(presenterState.presentation).toBe((mocks.presentationState as { presentation: Presentation }).presentation);
    expect(presenterState.presentation.id).toBe("presentation-staged-master");
    expect(presenterState.livePresentation).toBe((mocks.presentationState as { livePresentation: Presentation }).livePresentation);
  });

  it("uses materializeSlide on the same referential live Slide", () => {
    const livePresentation = (mocks.presentationState as { livePresentation: Presentation }).livePresentation;
    expect(livePresentation.slides[0]?.elements).toEqual([]);
    const ids: string[] = [];
    visitSlideElements(materializeSlide(livePresentation, livePresentation.slides[0]!).slide, (element) => ids.push(element.id));
    expect(ids).toContain("live-master-gallery");
  });
});
