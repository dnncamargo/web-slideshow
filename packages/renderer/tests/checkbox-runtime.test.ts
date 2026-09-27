import { describe, expect, it, vi } from "vitest";

import {
  hydrateCheckboxes,
  setCheckboxRuntimeState,
  type CheckboxRuntimeState,
} from "../src/checkbox-runtime";

type CheckboxListener = () => void;

class FakeCheckbox {
  readonly tagName = "INPUT";
  readonly type = "checkbox";
  readonly dataset: Record<string, string> = {
    presentationCheckbox: "true",
    presentationCheckboxMode: "two-state",
  };
  checked = false;
  indeterminate = false;
  private readonly listeners = new Map<string, CheckboxListener[]>();
  private readonly attributes = new Map<string, string>();

  addEventListener(type: string, listener: CheckboxListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  activate(): void {
    this.checked = !this.checked;
    this.indeterminate = false;
    for (const listener of this.listeners.get("click") ?? []) listener();
  }
}

class FakeNonCheckbox {
  readonly tagName = "DIV";
  readonly type = "div";
  readonly dataset = {
    presentationCheckbox: "true",
    presentationCheckboxMode: "three-state",
  };
  listenerCount(): number {
    return 0;
  }
}

function checkboxRoot(...children: unknown[]) {
  return {
    querySelectorAll: <T>(_selector: string): T[] => children as T[],
  };
}

function selfRoot(input: FakeCheckbox) {
  return Object.assign(input, {
    matches: (selector: string) => selector === '[data-presentation-checkbox="true"]',
    querySelectorAll: <T>(_selector: string): T[] => [],
  });
}

function nativeInput(input: FakeCheckbox): HTMLInputElement {
  return input as unknown as HTMLInputElement;
}

describe("hydrateCheckboxes", () => {
  it("discovers descendant checkboxes and initializes native state", () => {
    const input = new FakeCheckbox();

    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);

    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute("aria-checked")).toBe("false");
    expect(input.listenerCount("click")).toBe(1);
  });

  it("supports a matching root checkbox", () => {
    const input = new FakeCheckbox();

    hydrateCheckboxes(selfRoot(input) as unknown as ParentNode);

    expect(input.listenerCount("click")).toBe(1);
    input.activate();
    expect(input.checked).toBe(true);
  });

  it.each([
    ["checked", true, false, "checked"],
    ["intermediate", false, true, "intermediate"],
  ] as const)("recognizes an initially %s native input", (_name, checked, indeterminate, expectedState) => {
    const input = new FakeCheckbox();
    input.checked = checked;
    input.indeterminate = indeterminate;

    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);
    input.activate();

    if (expectedState === "checked") {
      expect(input.checked).toBe(false);
      expect(input.indeterminate).toBe(false);
      expect(input.getAttribute("aria-checked")).toBe("false");
    } else {
      expect(input.checked).toBe(true);
      expect(input.indeterminate).toBe(false);
      expect(input.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("cycles two-state checkboxes from unchecked to checked and back", () => {
    const input = new FakeCheckbox();
    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);

    input.activate();
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute("aria-checked")).toBe("true");

    input.activate();
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute("aria-checked")).toBe("false");
  });

  it.each([
    ["unchecked", false, false, "false"],
    ["intermediate", false, true, "mixed"],
    ["checked", true, false, "true"],
  ] as const)("applies an externally requested %s state", (state, checked, indeterminate, ariaChecked) => {
    const input = new FakeCheckbox();

    expect(setCheckboxRuntimeState(nativeInput(input), state)).toBe(true);
    expect(input.checked).toBe(checked);
    expect(input.indeterminate).toBe(indeterminate);
    expect(input.getAttribute("aria-checked")).toBe(ariaChecked);
    expect(input.listenerCount("click")).toBe(1);
  });

  it("keeps external intermediate state in the runtime instance for three-state activation", () => {
    const input = new FakeCheckbox();
    input.dataset.presentationCheckboxMode = "three-state";

    expect(setCheckboxRuntimeState(nativeInput(input), "intermediate")).toBe(true);
    input.activate();

    expect(input.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps external intermediate state in the runtime instance for two-state activation", () => {
    const input = new FakeCheckbox();

    expect(setCheckboxRuntimeState(nativeInput(input), "intermediate")).toBe(true);
    input.activate();

    expect(input.getAttribute("aria-checked")).toBe("true");
  });

  it("does not notify for external state application or hydration", () => {
    const input = new FakeCheckbox();
    const changes: CheckboxRuntimeState[] = [];
    const onChange = (_changedInput: HTMLInputElement, state: CheckboxRuntimeState) => {
      changes.push(state);
    };

    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode, { onChange });
    expect(changes).toEqual([]);
    expect(setCheckboxRuntimeState(nativeInput(input), "checked")).toBe(true);
    expect(changes).toEqual([]);
  });

  it("notifies once after each local activation with the canonical state and exact input", () => {
    const input = new FakeCheckbox();
    const changes: Array<{ input: HTMLInputElement; state: CheckboxRuntimeState }> = [];

    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode, {
      onChange: (changedInput, state) => changes.push({ input: changedInput, state }),
    });
    input.activate();
    input.activate();

    expect(changes).toEqual([
      { input: nativeInput(input), state: "checked" },
      { input: nativeInput(input), state: "unchecked" },
    ]);
  });

  it("cycles three-state checkboxes through intermediate state", () => {
    const input = new FakeCheckbox();
    input.dataset.presentationCheckboxMode = "three-state";
    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);

    input.activate();
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute("aria-checked")).toBe("mixed");

    input.activate();
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute("aria-checked")).toBe("true");

    input.activate();
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute("aria-checked")).toBe("false");
  });

  it("reports every canonical state for local three-state activation", () => {
    const input = new FakeCheckbox();
    input.dataset.presentationCheckboxMode = "three-state";
    const states: CheckboxRuntimeState[] = [];

    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode, {
      onChange: (_changedInput, state) => states.push(state),
    });
    input.activate();
    input.activate();
    input.activate();

    expect(states).toEqual(["intermediate", "checked", "unchecked"]);
  });

  it("does not duplicate listeners or reset state on repeated hydration", () => {
    const input = new FakeCheckbox();
    const root = checkboxRoot(input);
    hydrateCheckboxes(root as unknown as ParentNode);
    input.activate();
    hydrateCheckboxes(root as unknown as ParentNode);

    expect(input.listenerCount("click")).toBe(1);
    expect(input.checked).toBe(true);
    expect(input.getAttribute("aria-checked")).toBe("true");
  });

  it("does not duplicate callback invocation when hydration repeats", () => {
    const input = new FakeCheckbox();
    const onChange = vi.fn();
    const root = checkboxRoot(input);

    hydrateCheckboxes(root as unknown as ParentNode, { onChange });
    hydrateCheckboxes(root as unknown as ParentNode, { onChange });
    input.activate();

    expect(input.listenerCount("click")).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("updates the active callback without adding a listener", () => {
    const input = new FakeCheckbox();
    const first = vi.fn();
    const second = vi.fn();
    const root = checkboxRoot(input);

    hydrateCheckboxes(root as unknown as ParentNode, { onChange: first });
    hydrateCheckboxes(root as unknown as ParentNode, { onChange: second });
    input.activate();

    expect(input.listenerCount("click")).toBe(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("preserves the callback when repeated hydration omits options", () => {
    const input = new FakeCheckbox();
    const onChange = vi.fn();
    const root = checkboxRoot(input);

    hydrateCheckboxes(root as unknown as ParentNode, { onChange });
    hydrateCheckboxes(root as unknown as ParentNode);
    input.activate();

    expect(onChange).toHaveBeenCalledOnce();
  });

  it("clears the callback when hydration receives explicit empty options", () => {
    const input = new FakeCheckbox();
    const onChange = vi.fn();
    const root = checkboxRoot(input);

    hydrateCheckboxes(root as unknown as ParentNode, { onChange });
    hydrateCheckboxes(root as unknown as ParentNode, {});
    input.activate();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps independently discovered and nested checkboxes independent", () => {
    const first = new FakeCheckbox();
    const second = new FakeCheckbox();
    second.dataset.presentationCheckboxMode = "three-state";
    const changes: Array<{ input: HTMLInputElement; state: CheckboxRuntimeState }> = [];

    hydrateCheckboxes(checkboxRoot(first, second) as unknown as ParentNode, {
      onChange: (input, state) => changes.push({ input, state }),
    });
    first.activate();
    second.activate();

    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(second.getAttribute("aria-checked")).toBe("mixed");
    expect(first.listenerCount("click")).toBe(1);
    expect(second.listenerCount("click")).toBe(1);
    expect(changes).toEqual([
      { input: nativeInput(first), state: "checked" },
      { input: nativeInput(second), state: "intermediate" },
    ]);
  });

  it("uses two-state behavior for missing or unrecognized modes", () => {
    const missing = new FakeCheckbox();
    delete missing.dataset.presentationCheckboxMode;
    const unknown = new FakeCheckbox();
    unknown.dataset.presentationCheckboxMode = "invalid";

    hydrateCheckboxes(checkboxRoot(missing, unknown) as unknown as ParentNode);
    missing.activate();
    unknown.activate();

    expect(missing.getAttribute("aria-checked")).toBe("true");
    expect(unknown.getAttribute("aria-checked")).toBe("true");
  });

  it("reads mode on each activation", () => {
    const input = new FakeCheckbox();
    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);

    input.activate();
    input.dataset.presentationCheckboxMode = "three-state";
    input.activate();
    input.activate();

    expect(input.getAttribute("aria-checked")).toBe("mixed");
  });

  it("ignores non-checkbox nodes", () => {
    const nonCheckbox = new FakeNonCheckbox();

    hydrateCheckboxes(checkboxRoot(nonCheckbox) as unknown as ParentNode);

    expect(nonCheckbox.listenerCount()).toBe(0);
  });

  it("rejects an invalid external target safely", () => {
    expect(setCheckboxRuntimeState({} as HTMLInputElement, "checked")).toBe(false);
    expect(setCheckboxRuntimeState(new FakeNonCheckbox() as unknown as HTMLInputElement, "checked")).toBe(false);
  });

  it("does not couple the state to the post-activation native properties", () => {
    const input = new FakeCheckbox();
    input.dataset.presentationCheckboxMode = "three-state";
    hydrateCheckboxes(checkboxRoot(input) as unknown as ParentNode);

    input.activate();
    expect(input.indeterminate).toBe(true);
    input.activate();
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);

    nativeInput(input).checked = false;
    nativeInput(input).indeterminate = true;
    input.activate();
    expect(input.getAttribute("aria-checked")).toBe("false");
  });
});
