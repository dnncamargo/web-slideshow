// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import { findElementById } from "../src/features/editor/element-tree";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function presentation(elements: Presentation["slides"][number]["elements"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d1c-qr-history",
    title: "CP4D1C QR history",
    slides: [{ id: "slide-1", title: "Slide 1", summary: "", speakerNotes: "", elements }],
  });
}

function linkedText(id: string, href = "https://example.com/source") {
  return {
    type: "text" as const,
    id,
    hidden: false,
    variant: "body" as const,
    content: id,
    link: { kind: "url" as const, href, target: "_blank" as const },
  };
}

function linkedImage(id: string, href = "https://example.com/source") {
  return {
    type: "image" as const,
    id,
    hidden: false,
    src: `/${id}.png`,
    alt: id,
    link: { kind: "url" as const, href, target: "_blank" as const },
  };
}

function linkedContainer(id: string, href = "https://example.com/container") {
  return {
    type: "container" as const,
    id,
    hidden: false,
    link: { kind: "url" as const, href, target: "_blank" as const },
    children: [linkedText(`${id}-child`)],
  };
}

function sourceButton(container: HTMLElement): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes("Create QR code from link"));
  if (!button) throw new Error("Create QR code button was not rendered");
  return button;
}

function canvasElement(container: HTMLElement, id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
  if (!element) throw new Error(`element ${id} was not rendered`);
  return element;
}

function lastCommittedPresentation(): Presentation {
  const next = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
  if (!next) throw new Error("expected a committed presentation");
  return next;
}

function qrDomSnapshot(container: HTMLElement, id: string): { src: string; alt: string } {
  const element = canvasElement(container, id);
  const image = element.matches("img") ? element : element.querySelector<HTMLImageElement>("img");
  if (!(image instanceof HTMLImageElement)) throw new Error("expected QR Image DOM output");
  return { src: image.src, alt: image.alt };
}

describe("CP4D1C QR creation history", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(historyState.commitHistory).mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function mount(next: Presentation): Promise<void> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={next} /></StudioI18nProvider>);
    });
  }

  async function select(id: string): Promise<void> {
    await act(async () => canvasElement(container, id).dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function createQr(): Promise<void> {
    await act(async () => sourceButton(container).click());
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
  }

  it("tracks a root QR Image as one normal Add and restores the exact snapshot on redo", async () => {
    const href = "https://example.com/source";
    await mount(presentation([linkedText("source", href), linkedText("next", "https://example.com/next")]));
    await select("source");
    await createQr();

    const committed = lastCommittedPresentation();
    const elements = committed.slides[0]?.elements ?? [];
    const source = findElementById(elements, "source");
    const qr = elements[1];
    if (
      !source ||
      (source.type !== "text" && source.type !== "image" && source.type !== "container") ||
      !qr ||
      qr.type !== "image"
    ) throw new Error("expected root QR Image snapshot");
    expect(elements.map((element) => element.id)).toEqual(["source", qr.id, "next"]);
    expect(source.link).toEqual({ kind: "url", href, target: "_blank" });
    expect(qr).toMatchObject({ type: "image", alt: `QR code for ${href}` });
    expect(qr.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      { kind: "element.add", labelKey: "history.element.add", labelParams: { elementType: "image" } },
    );

    const qrId = qr.id;
    const qrSrc = qr.src;
    await undo();
    expect(container.querySelector(`[data-powershow-id="${qrId}"]`)).toBeNull();
    await select("source");
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
    await redo();
    expect(qrDomSnapshot(container, qrId)).toEqual({ src: qrSrc, alt: `QR code for ${href}` });
    expect(container.querySelector(`[data-powershow-id="${qrId}"]`)).not.toBeNull();
    await select("source");
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe(href);
    expect(container.querySelector<HTMLSelectElement>("#text-link-target")?.value).toBe("new");
  });

  it("inserts a nested QR Image after its source in the same Container", async () => {
    const source = linkedText("nested-source");
    const next = linkedText("nested-next", "https://example.com/next");
    const rootContainer = { id: "container-1", type: "container" as const, hidden: false, children: [source, next] };
    await mount(presentation([rootContainer]));
    await select(source.id);
    await createQr();

    const committed = lastCommittedPresentation();
    const committedContainer = findElementById(committed.slides[0]?.elements ?? [], rootContainer.id);
    if (!committedContainer || committedContainer.type !== "container") throw new Error("expected Container");
    const qr = committedContainer.children[1];
    if (!qr || qr.type !== "image") throw new Error("expected nested QR Image");
    expect(committedContainer.children.map((element) => element.id)).toEqual([source.id, qr.id, next.id]);
    expect(committedContainer.children).toHaveLength(3);

    const qrId = qr.id;
    const qrSrc = qr.src;
    await undo();
    expect(container.querySelector(`[data-powershow-id="${qrId}"]`)).toBeNull();
    await redo();
    expect(qrDomSnapshot(container, qrId).src).toBe(qrSrc);
  });

  it("keeps a linked Container source and its QR Image as root siblings", async () => {
    const source = linkedContainer("source-container");
    const next = linkedText("root-next", "https://example.com/next");
    await mount(presentation([source, next]));
    await select(source.id);
    await createQr();

    const committed = lastCommittedPresentation();
    const elements = committed.slides[0]?.elements ?? [];
    const committedSource = findElementById(elements, source.id);
    const qr = elements[1];
    if (!committedSource || committedSource.type !== "container" || !qr || qr.type !== "image") {
      throw new Error("expected Container source and sibling QR Image");
    }
    expect(elements.map((element) => element.id)).toEqual([source.id, qr.id, next.id]);
    expect(committedSource.children.map((element) => element.id)).toEqual(["source-container-child"]);
    expect(committedSource.link).toEqual(source.link);
  });

  it("keeps link history separate from the subsequent QR Add", async () => {
    await mount(presentation([{
      type: "text",
      id: "source",
      hidden: false,
      variant: "body",
      content: "Source",
    }]));
    await select("source");

    const url = container.querySelector<HTMLInputElement>("#text-link-url");
    if (!url) throw new Error("URL input was not rendered");
    await act(async () => {
      url.focus();
      changeInput(url, "https://example.com/linked");
      url.blur();
    });
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);

    await createQr();
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    const committed = lastCommittedPresentation();
    const qr = committed.slides[0]?.elements[1];
    if (!qr || qr.type !== "image") throw new Error("expected QR Image after link action");
    const qrId = qr.id;

    await undo();
    expect(container.querySelector(`[data-powershow-id="${qrId}"]`)).toBeNull();
    await select("source");
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe("https://example.com/linked");
    await undo();
    await select("source");
    expect(container.querySelector<HTMLInputElement>("#text-link-url")?.value).toBe("");
  });

});
