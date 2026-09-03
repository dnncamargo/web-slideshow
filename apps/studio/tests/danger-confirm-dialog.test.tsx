// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DangerConfirmDialog } from "../src/features/app/danger-confirm-dialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DangerConfirmDialog keyboard confirmation", () => {
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

  async function renderDialog(props: Partial<ComponentProps<typeof DangerConfirmDialog>> = {}) {
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

  it("confirms once when Enter is pressed on the focused dialog surface", async () => {
    const { onConfirm } = await renderDialog({ confirmOnEnter: true });

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!;
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not confirm on Enter when opt-in is omitted", async () => {
    const { onConfirm } = await renderDialog();

    container.querySelector<HTMLDivElement>('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps Escape cancellation and does not intercept button Enter", async () => {
    const { onCancel, onConfirm } = await renderDialog({ confirmOnEnter: true });

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!;
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const cancelButton = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Cancel",
    )!;
    cancelButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
