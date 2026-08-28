// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { StudioEditorMount } from "../src/features/editor/studio-editor-mount";
import { InvalidPersistedPresentationError } from "../src/features/persistence/persistence-errors";
import type { PresentationRecoveryInspection } from "../src/features/persistence/presentation-repository";

const testDeps = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  getPresentation: vi.fn(),
  inspectPresentationRecovery: vi.fn(),
  repairPresentation: vi.fn(),
  savePresentation: vi.fn(async () => {}),
  publishPresentation: vi.fn(async () => ({
    publicationId: "publication-id",
    versionId: "version-id",
    publishedRevision: 1,
    createdVersion: false,
  })),
  editorRendered: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => testDeps.router,
}));

vi.mock("@/features/editor/editor-workspace", async () => {
  const React = await import("react");

  return {
    EditorWorkspace: (props: Record<string, unknown>) => {
      testDeps.editorRendered(props);
      return React.createElement("div", { "data-testid": "editor-workspace" });
    },
  };
});

vi.mock("@/features/persistence/presentation-repository-instance", () => ({
  getDefaultPresentationRepository: () => ({
    getPresentation: testDeps.getPresentation,
    inspectPresentationRecovery: testDeps.inspectPresentationRecovery,
    repairPresentation: testDeps.repairPresentation,
    savePresentation: testDeps.savePresentation,
    publishPresentation: testDeps.publishPresentation,
  }),
}));

vi.mock("@/features/persistence/presentation-notes-repository-instance", () => ({
  getDefaultPresentationNotesRepository: () => ({}),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const RECOVERABLE_INSPECTION: PresentationRecoveryInspection = {
  status: "recoverable",
  issues: [
    {
      kind: "element",
      path: ["slides", 0, "elements", 1],
      action: "remove",
      id: "bad-leaf",
      elementType: "text",
      reason: "Invalid element",
    },
  ],
};

const UNRECOVERABLE_INSPECTION: PresentationRecoveryInspection = {
  status: "unrecoverable",
  issues: [
    {
      kind: "element",
      path: [],
      action: "remove",
      reason: "Invalid presentation structure",
    },
  ],
};

describe("StudioEditorMount recovery flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function render(presentationId: string | null = "pres-1") {
    root.render(
      <StudioI18nProvider>
        <StudioEditorMount presentationId={presentationId} />
      </StudioI18nProvider>,
    );
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("keeps the generic load failure for real Firestore errors", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new Error("permission denied"),
    );

    act(() => {
      render();
    });
    await flush();

    expect(container.textContent ?? "").toContain(
      "Could not load presentation.",
    );
    expect(testDeps.inspectPresentationRecovery).not.toHaveBeenCalled();
    expect(container.querySelector('[data-powershow-recovery="recoverable"]'))
      .toBeNull();
  });

  it("enters the recovery UI only for InvalidPersistedPresentationError", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );

    act(() => {
      render();
    });
    await flush();

    expect(testDeps.inspectPresentationRecovery).toHaveBeenCalledWith("pres-1");
    expect(
      container.querySelector('[data-powershow-recovery="recoverable"]'),
    ).not.toBeNull();
    expect(container.textContent ?? "").toContain(
      "Presentation contains incompatible content",
    );
    expect(container.textContent ?? "").toContain("1 issues found");
    expect(container.querySelector('[data-powershow-recovery-panel]')).not.toBeNull();
    expect(container.querySelector('[data-powershow-recovery-summary="true"]')).not.toBeNull();
    expect(container.querySelector('[data-powershow-recovery-actions="true"]')).not.toBeNull();
    expect(container.querySelector('[data-powershow-recovery-open="true"]')).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll("button")).some((button) =>
        button.textContent?.includes("Back to Library"),
      ),
    ).toBe(true);
  });

  it("performs no repair on mount", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );

    act(() => {
      render();
    });
    await flush();

    expect(testDeps.repairPresentation).not.toHaveBeenCalled();
    expect(testDeps.savePresentation).not.toHaveBeenCalled();
    expect(testDeps.editorRendered).not.toHaveBeenCalled();
  });

  it("renders issue details with path, id, type and reason", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );

    act(() => {
      render();
    });
    await flush();

    expect(container.querySelector("[data-powershow-recovery-details]")).toBeNull();

    const summaryToggle = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View details"),
    );
    expect(summaryToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(summaryToggle?.getAttribute("aria-controls")).toBe(
      "powershow-recovery-details",
    );

    const detailsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View details"),
    );

    act(() => {
      detailsButton?.click();
    });

    expect(summaryToggle?.getAttribute("aria-expanded")).toBe("true");

    const details = container.querySelector(
      "[data-powershow-recovery-details]",
    );

    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("slides[0].elements[1]");
    expect(details?.textContent).toContain("bad-leaf");
    expect(details?.textContent).toContain("text");
    expect(details?.textContent).toContain("Invalid element");

    act(() => {
      detailsButton?.click();
    });
    expect(summaryToggle?.getAttribute("aria-expanded")).toBe("false");
  });

  it("requires explicit confirmation before calling repair", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );
    testDeps.repairPresentation.mockResolvedValue({
      presentation: { id: "pres-1" } as Presentation,
      repaired: true,
    });

    act(() => {
      render();
    });
    await flush();

    const openButton = container.querySelector<HTMLButtonElement>(
      '[data-powershow-recovery-open="true"]',
    );

    expect(openButton).not.toBeNull();

    act(() => {
      openButton?.click();
    });

    // Confirmation state shown; repair NOT called yet.
    expect(
      container.querySelector('[data-powershow-recovery-confirm="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-powershow-recovery-confirm="true"] [data-powershow-recovery-panel]',
      ),
    ).not.toBeNull();
    expect(testDeps.repairPresentation).not.toHaveBeenCalled();
  });

  it("cancel performs no write and returns to the recovery screen", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );

    act(() => {
      render();
    });
    await flush();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-powershow-recovery-open="true"]')
        ?.click();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-powershow-recovery-cancel="true"]')
        ?.click();
    });

    expect(
      container.querySelector('[data-powershow-recovery="recoverable"]'),
    ).not.toBeNull();
    expect(testDeps.repairPresentation).not.toHaveBeenCalled();
    expect(testDeps.editorRendered).not.toHaveBeenCalled();
  });

  it("calls repair exactly once on confirm and opens the editor", async () => {
    const repaired = { id: "pres-1", title: "Repaired" } as Presentation;

    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );
    testDeps.repairPresentation.mockResolvedValue({
      presentation: repaired,
      repaired: true,
    });

    act(() => {
      render();
    });
    await flush();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-powershow-recovery-open="true"]')
        ?.click();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-powershow-recovery-confirm-action="true"]',
        )
        ?.click();
    });

    expect(testDeps.repairPresentation).toHaveBeenCalledTimes(1);
    expect(testDeps.repairPresentation).toHaveBeenCalledWith("pres-1");

    await flush();

    expect(container.querySelector('[data-testid="editor-workspace"]')).not.toBeNull();
    expect(testDeps.editorRendered).toHaveBeenCalled();
    const props = testDeps.editorRendered.mock.calls[0]?.[0] as {
      initialPresentation?: Presentation;
    };
    expect(props?.initialPresentation).toBe(repaired);
  });

  it("shows no destructive action for an unrecoverable inspection", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      UNRECOVERABLE_INSPECTION,
    );

    act(() => {
      render();
    });
    await flush();

    expect(
      container.querySelector('[data-powershow-recovery-unrecoverable="true"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-powershow-recovery-unrecoverable="true"] [data-powershow-recovery-panel]')).not.toBeNull();
    expect(
      container.querySelector('[data-powershow-recovery-open="true"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-powershow-recovery-confirm="true"]'),
    ).toBeNull();
    expect(testDeps.repairPresentation).not.toHaveBeenCalled();
    expect(container.textContent ?? "").toContain(
      "Presentation cannot be repaired",
    );
  });

  it("shows unrecoverable after the repair itself reports failure", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );
    const { PresentationRecoveryFailedError } = await import(
      "../src/features/persistence/persistence-errors"
    );
    testDeps.repairPresentation.mockRejectedValueOnce(
      new PresentationRecoveryFailedError("cannot repair"),
    );

    act(() => {
      render();
    });
    await flush();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-powershow-recovery-open="true"]')
        ?.click();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-powershow-recovery-confirm-action="true"]',
        )
        ?.click();
    });

    await flush();

    expect(testDeps.repairPresentation).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-powershow-recovery-unrecoverable="true"]'),
    ).not.toBeNull();
    expect(testDeps.editorRendered).not.toHaveBeenCalled();
  });

  it("does not fake a loaded editor when repair fails", async () => {
    testDeps.getPresentation.mockRejectedValueOnce(
      new InvalidPersistedPresentationError("invalid"),
    );
    testDeps.inspectPresentationRecovery.mockResolvedValueOnce(
      RECOVERABLE_INSPECTION,
    );
    testDeps.repairPresentation.mockRejectedValueOnce(new Error("boom"));

    act(() => {
      render();
    });
    await flush();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-powershow-recovery-open="true"]')
        ?.click();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-powershow-recovery-confirm-action="true"]',
        )
        ?.click();
    });

    await flush();

    expect(
      container.querySelector('[data-powershow-recovery-failed="true"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="editor-workspace"]')).toBeNull();
    expect(testDeps.editorRendered).not.toHaveBeenCalled();
  });

  it("never lets an old getPresentation result overwrite a newer presentationId", async () => {
    const oldRequest = deferred<Presentation>();

    const newPresentation = { id: "pres-new", title: "New" } as Presentation;

    testDeps.getPresentation
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(async () => newPresentation);

    act(() => {
      render("pres-old");
    });

    // A newer presentationId starts while the old request is pending.
    act(() => {
      render("pres-new");
    });
    await flush();

    // The old request resolves AFTER the newer one already loaded.
    await act(async () => {
      oldRequest.resolve({ id: "pres-old", title: "Old" } as Presentation);
      await Promise.resolve();
    });

    expect(testDeps.editorRendered).toHaveBeenCalledTimes(1);
    const props = testDeps.editorRendered.mock.calls[0]?.[0] as {
      initialPresentation?: Presentation;
    };
    expect(props?.initialPresentation?.id).toBe("pres-new");
  });

  it("never lets an old recovery inspection overwrite a newer presentationId", async () => {
    const oldInspection = deferred<PresentationRecoveryInspection>();

    const newPresentation = { id: "pres-new", title: "New" } as Presentation;

    testDeps.getPresentation
      .mockImplementationOnce(async () => {
        throw new InvalidPersistedPresentationError("invalid");
      })
      .mockImplementationOnce(async () => newPresentation);

    testDeps.inspectPresentationRecovery.mockImplementationOnce(
      () => oldInspection.promise,
    );

    act(() => {
      render("pres-old");
    });
    await flush();

    // A newer presentationId starts while the old inspection is pending.
    act(() => {
      render("pres-new");
    });
    await flush();

    // The old inspection resolves AFTER the newer presentation loaded.
    await act(async () => {
      oldInspection.resolve(RECOVERABLE_INSPECTION);
      await Promise.resolve();
    });

    expect(testDeps.editorRendered).toHaveBeenCalledTimes(1);
    const props = testDeps.editorRendered.mock.calls[0]?.[0] as {
      initialPresentation?: Presentation;
    };
    expect(props?.initialPresentation?.id).toBe("pres-new");
    expect(
      container.querySelector('[data-powershow-recovery="recoverable"]'),
    ).toBeNull();
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
