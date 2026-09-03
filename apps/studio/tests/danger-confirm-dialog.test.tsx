// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DangerConfirmDialog } from "../src/features/app/danger-confirm-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DangerConfirmDialog initial focus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function renderDialog(
    props: Partial<ComponentProps<typeof DangerConfirmDialog>> = {},
  ) {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    await act(async () => {
      root.render(
        <DangerConfirmDialog
          title="Delete"
          message="Delete this element?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={onCancel}
          onConfirm={onConfirm}
          {...props}
        />,
      );
    });
    return { onCancel, onConfirm };
  }

  it("focuses the dialog surface by default", async () => {
    await renderDialog();

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(container.querySelector<HTMLButtonElement>("button[autofocus]")).toBeNull();
  });

  it("focuses the confirm button for the opt-in mode", async () => {
    await renderDialog({ initialFocus: "confirm" });

    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Delete");
    expect(confirm).toBeDefined();
    expect(document.activeElement).toBe(confirm);
  });

  it("preserves Escape cancellation and busy action behavior", async () => {
    const { onCancel, onConfirm } = await renderDialog({ initialFocus: "confirm" });
    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!;

    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await renderDialog({ busy: true });
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    expect(Array.from(buttons).every((button) => button.disabled)).toBe(true);
    await act(async () => buttons[1]?.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
