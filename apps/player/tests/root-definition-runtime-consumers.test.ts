import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  materializeSlide,
  PresentationSchema,
  visitSlideElements,
  type MaterializedSlide,
  type Presentation,
} from "@web-slideshow/document-schema";

const firebase = vi.hoisted(() => ({
  onChildAdded: vi.fn(),
  onChildChanged: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
  runTransaction: vi.fn(),
  set: vi.fn(),
}));

vi.mock("firebase/database", () => firebase);

import {
  subscribeLiveGalleryControl,
} from "../src/live-gallery-control";
import {
  createLiveScriptedActionTracker,
  subscribeLiveScriptedAction,
} from "../src/live-scripted-action";
import {
  createLiveScriptedInputTracker,
  subscribeLiveScriptedInput,
} from "../src/live-scripted-input";
import {
  createLiveScriptedStatePublisher,
} from "../src/live-scripted-state";

function rootPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-runtime",
    title: "Root runtime",
    description: "",
    aspectRatio: "16:9",
    defaultRootDefinitionId: "master",
    rootDefinitions: [{
      id: "master",
      name: "Master",
      root: {
        id: "master-root",
        type: "container",
        children: [
          {
            id: "master-gallery",
            type: "gallery",
            items: [{ src: "master-a", alt: "" }, { src: "master-b", alt: "" }],
          },
          {
            id: "master-scripted",
            type: "scripted",
            title: "Master scripted",
            html: "",
            css: "",
            script: "",
            ports: [
              { id: "action", label: "Action", kind: "action" },
              { id: "out", label: "Output", kind: "boolean", direction: "output" },
            ],
          },
          {
            id: "local-target",
            type: "container",
            children: [],
          },
        ],
      },
      localChildTargetIds: ["local-target"],
    }],
    slides: [{
      id: "page",
      elements: [],
      localRootChildren: [{
        targetContainerId: "local-target",
        children: [
          {
            id: "local-gallery",
            type: "gallery",
            items: [{ src: "local-a", alt: "" }, { src: "local-b", alt: "" }],
          },
          {
            id: "local-scripted",
            type: "scripted",
            title: "Local scripted",
            html: "",
            css: "",
            script: "",
            ports: [
              { id: "action", label: "Action", kind: "action" },
              { id: "input", label: "Input", kind: "number", direction: "input", min: 0, max: 1 },
            ],
          },
        ],
      }],
    }],
  });
}

function effectiveSlide(presentation: Presentation): MaterializedSlide {
  return materializeSlide(presentation, presentation.slides[0]!).slide;
}

function galleryRecord(elementId: string, revision = 1) {
  return {
    activationRevision: 2,
    currentVersionId: "version-1",
    revision,
    pageId: "page",
    elementId,
    targetIndex: 1,
    expanded: true,
  };
}

function actionRecord(elementId: string, revision = 1) {
  return {
    activationRevision: 2,
    currentVersionId: "version-1",
    revision,
    pageId: "page",
    elementId,
    portId: "action",
    targetBootId: "boot-1",
  };
}

function inputRecord(overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 2,
    currentVersionId: "version-1",
    revision: 1,
    pageId: "page",
    elementId: "local-scripted",
    portId: "input",
    targetBootId: "boot-1",
    targetMountRevision: 1,
    value: 0.25,
    ...overrides,
  };
}

function snapshot(value: unknown) {
  return { val: () => value };
}

beforeEach(() => {
  vi.clearAllMocks();
  firebase.ref.mockReturnValue({});
  firebase.set.mockResolvedValue(undefined);
  firebase.runTransaction.mockImplementation(async (_ref, update) => update(null));
});

describe("Root Definition runtime consumers", () => {
  it("discovers master and slide-local Galleries from the materialized tree", () => {
    const presentation = rootPresentation();
    const canonicalSlide = presentation.slides[0]!;
    const slide = effectiveSlide(presentation);
    const controller = {
      getCurrentIndex: vi.fn(() => 0),
      getCurrentSlide: vi.fn(() => slide),
      setGalleryActiveIndex: vi.fn(),
      setGalleryExpanded: vi.fn(),
    };
    let changed: ((value: { key: string; val(): unknown }) => void) | undefined;
    firebase.onChildAdded.mockReturnValue(vi.fn());
    firebase.onChildChanged.mockImplementation((_ref, callback) => {
      changed = callback;
      return vi.fn();
    });

    subscribeLiveGalleryControl(
      {} as never,
      2,
      "version-1",
      presentation,
      controller as never,
    );

    expect(canonicalSlide.elements).toEqual([]);
    expect(canonicalSlide.rootDefinitionId).toBeUndefined();
    changed?.({ key: "0", val: () => galleryRecord("master-gallery") });
    changed?.({ key: "1", val: () => galleryRecord("local-gallery") });

    expect(controller.setGalleryActiveIndex).toHaveBeenNthCalledWith(1, "master-gallery", 1);
    expect(controller.setGalleryExpanded).toHaveBeenNthCalledWith(1, "master-gallery", true);
    expect(controller.setGalleryActiveIndex).toHaveBeenNthCalledWith(2, "local-gallery", 1);
    expect(controller.setGalleryExpanded).toHaveBeenNthCalledWith(2, "local-gallery", true);
  });

  it("discovers master and slide-local Scripted action ports from the materialized tree", () => {
    const presentation = rootPresentation();
    const canonicalSlide = presentation.slides[0]!;
    const slide = effectiveSlide(presentation);
    const controller = {
      getCurrentIndex: vi.fn(() => 0),
      getCurrentSlide: vi.fn(() => slide),
      sendScriptedAction: vi.fn(),
    };
    let callback: ((value: { val(): unknown }) => void) | undefined;
    firebase.onValue.mockImplementation((_ref, next) => {
      callback = next;
      return vi.fn();
    });

    subscribeLiveScriptedAction(
      {} as never,
      2,
      "version-1",
      "boot-1",
      presentation,
      controller as never,
      createLiveScriptedActionTracker(),
    );

    expect(canonicalSlide.elements).toEqual([]);
    callback?.({ val: () => ({
      0: { 0: actionRecord("master-scripted") },
      1: { 0: actionRecord("local-scripted") },
    }) });

    expect(controller.sendScriptedAction).toHaveBeenNthCalledWith(1, "master-scripted", "action");
    expect(controller.sendScriptedAction).toHaveBeenNthCalledWith(2, "local-scripted", "action");
  });

  it("validates and dispatches Scripted input against a Root-backed effective Slide", () => {
    const presentation = rootPresentation();
    const slide = effectiveSlide(presentation);
    const scriptedIds: string[] = [];
    visitSlideElements(slide, (element) => {
      if (element.type === "scripted") scriptedIds.push(element.id);
    });
    expect(scriptedIds).toEqual(["master-scripted", "local-scripted"]);
    let localScripted: Extract<Presentation["slides"][number]["elements"][number], { type: "scripted" }> | undefined;
    visitSlideElements(slide, (element) => {
      if (element.id === "local-scripted" && element.type === "scripted") localScripted = element;
    });
    expect(localScripted?.ports[1]).toMatchObject({ id: "input", kind: "number", direction: "input" });
    const controller = {
      getCurrentIndex: vi.fn(() => 0),
      getCurrentSlide: vi.fn(() => slide),
      sendScriptedInput: vi.fn(() => true),
    };
    let callback: ((value: { val(): unknown }) => void) | undefined;
    firebase.onValue.mockImplementation((_ref, next) => {
      callback = next;
      return vi.fn();
    });

    subscribeLiveScriptedInput(
      {} as never,
      2,
      "version-1",
      "boot-1",
      presentation,
      controller as never,
      () => ({ pageId: "page", elementId: "local-scripted", mountRevision: 1 }),
      createLiveScriptedInputTracker(),
    );

    callback?.({ val: () => ({ 1: { 1: inputRecord() } }) });
    expect(controller.sendScriptedInput).toHaveBeenCalledExactlyOnceWith(
      "local-scripted",
      "input",
      0.25,
    );
  });

  it("mounts and reports a master Scripted element without reading canonical elements", async () => {
    const presentation = rootPresentation();
    const canonicalSlide = presentation.slides[0]!;
    const slide = effectiveSlide(presentation);
    let mountRevision = 0;
    const publisher = createLiveScriptedStatePublisher({
      database: {} as never,
      activationRevision: 2,
      currentVersionId: "version-1",
      bootId: "boot-1",
      presentation,
      allocateMountRevision: () => ++mountRevision,
      isCurrent: () => true,
      getCurrentPageId: () => "page",
    });

    expect(canonicalSlide.elements).toEqual([]);
    publisher.onScriptedMount({
      pageId: "page",
      elementId: "master-scripted",
      slide,
    });
    expect(publisher.getCurrentMount(0)).toEqual({
      pageId: "page",
      elementId: "master-scripted",
      mountRevision: 1,
    });
    expect(firebase.set).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ pageId: "page", elementId: "master-scripted" }),
    );

    publisher.onScriptedReport({
      type: "scripted:report",
      elementId: "master-scripted",
      portId: "out",
      value: true,
    });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledOnce());
    const update = firebase.runTransaction.mock.calls[0]?.[1] as (value: unknown) => unknown;
    expect(update(null)).toMatchObject({
      pageId: "page",
      elementId: "master-scripted",
      portId: "out",
      value: true,
    });
  });
});
