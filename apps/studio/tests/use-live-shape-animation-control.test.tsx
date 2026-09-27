// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRealtimeDatabaseOrNull: vi.fn(), writeShapeAnimationAction: vi.fn() }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/features/control/control-command-writer", () => ({ writeShapeAnimationAction: mocks.writeShapeAnimationAction }));

import { PresentationSchema, materializeSlide } from "@web-slideshow/document-schema";
import { discoverLiveShapeAnimationTargets, useLiveShapeAnimationControl, type UseLiveShapeAnimationControlResult } from "../src/features/control/use-live-shape-animation-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 7 };
const READY = { kind: "ready" as const, presence: { activationRevision: 7, currentVersionId: "version-1", bootId: "boot-a", stage: "ready" as const, transitionedAt: 1 } };
const geometry = { mode: "path", viewBox: { x: 0, y: 0, width: 100, height: 100 }, commands: [{ type: "move", x: 0, y: 0 }, { type: "line", x: 100, y: 0 }, { type: "line", x: 100, y: 100 }, { type: "close" }] } as const;
const shape = (id: string, animation = true) => ({ id, type: "shape", hidden: false, geometry, ...(animation ? { animation: { durationMs: 1000, autoplay: false, rotate: { fromDeg: 0, toDeg: 90 } } } : {}) });
const presentation = (elements: unknown[]) => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "page-a", elements }] });
const effective = (elements: unknown[]) => presentation(elements).slides[0]!;

describe("useLiveShapeAnimationControl", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseLiveShapeAnimationControlResult | null;
  let input: Parameters<typeof useLiveShapeAnimationControl>[0];
  function Harness() { result = useLiveShapeAnimationControl(input); return null; }
  const render = async () => { await act(async () => root.render(<Harness />)); };

  beforeEach(async () => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); result = null;
    input = { live: LIVE, effectiveSlide: effective([shape("shape-a")]), desiredPageId: "page-a", actualPageId: "page-a", controlSynced: true, controlsBlocked: false, playerStatus: READY };
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({ database: true });
    mocks.writeShapeAnimationAction.mockResolvedValue({});
    await render();
  });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; vi.clearAllMocks(); });

  it("discovers only animated Shapes across canonical nested and materialized locations", () => {
    const targets = discoverLiveShapeAnimationTargets(effective([
      shape("root"), shape("static", false),
      { id: "container", type: "container", children: [shape("nested")] },
      { id: "table", type: "table", mode: "structured", columns: [{ id: "column", header: { id: "header", children: [shape("table-shape")] } }], rows: [{ id: "row", cells: [{ id: "cell", children: [shape("cell-shape")] }] }] },
      { id: "topics", type: "topics", items: [{ id: "item", content: { id: "content", children: [shape("topic-shape")] }, children: [] }] },
      { id: "plot", type: "plot", source: "y=x", animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 } },
    ]));
    expect(targets.map(({ shapeSlot, elementId, label }) => ({ shapeSlot, elementId, label }))).toEqual([
      { shapeSlot: 0, elementId: "root", label: "Shape 1" }, { shapeSlot: 1, elementId: "nested", label: "Shape 2" },
      { shapeSlot: 2, elementId: "table-shape", label: "Shape 3" }, { shapeSlot: 3, elementId: "cell-shape", label: "Shape 4" },
      { shapeSlot: 4, elementId: "topic-shape", label: "Shape 5" },
    ]);
    const rootPresentation = PresentationSchema.parse({ ...presentation([]), rootDefinitions: [{ id: "master", name: "Master", root: { id: "root", type: "container", children: [shape("master-shape"), { id: "target", type: "container", children: [] }] }, localChildTargetIds: ["target"] }], defaultRootDefinitionId: "master", slides: [{ id: "page-a", elements: [], localRootChildren: [{ targetContainerId: "target", children: [shape("local-shape")] }] }] });
    expect(discoverLiveShapeAnimationTargets(materializeSlide(rootPresentation, rootPresentation.slides[0]!).slide).map((target) => target.elementId)).toEqual(["master-shape", "local-shape"]);
  });

  it("gates writes, emits each action, suppresses pending duplicates, and resets on identity", async () => {
    expect(result?.actionsEnabled).toBe(true);
    await act(async () => { result?.triggerAction(result.shapeTargets[0]!, "play"); await Promise.resolve(); });
    expect(mocks.writeShapeAnimationAction).toHaveBeenCalledWith({ database: true }, expect.objectContaining({ shapeSlot: 0, elementId: "shape-a", action: "play" }));
    let resolveWrite!: () => void;
    mocks.writeShapeAnimationAction.mockImplementation(() => new Promise((resolve) => { resolveWrite = () => resolve({}); }));
    act(() => { result?.triggerAction(result.shapeTargets[0]!, "pause"); result?.triggerAction(result.shapeTargets[0]!, "reset"); });
    expect(mocks.writeShapeAnimationAction).toHaveBeenCalledTimes(2);
    input = { ...input, desiredPageId: null };
    await render();
    expect(result?.actionsEnabled).toBe(false);
    resolveWrite();
  });
});
