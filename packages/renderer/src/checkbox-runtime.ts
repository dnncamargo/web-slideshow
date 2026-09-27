export type CheckboxRuntimeState = "unchecked" | "intermediate" | "checked";
type CheckboxMode = "two-state" | "three-state";

export interface CheckboxRuntimeOptions {
  onChange?: (
    input: HTMLInputElement,
    state: CheckboxRuntimeState,
  ) => void;
}

interface CheckboxRuntimeInstance {
  state: CheckboxRuntimeState;
  onChange: CheckboxRuntimeOptions["onChange"];
  listener: () => void;
}

const checkboxInstances = new WeakMap<HTMLInputElement, CheckboxRuntimeInstance>();
const checkboxSelector = '[data-presentation-checkbox="true"]';

function isNativeCheckbox(candidate: unknown): candidate is HTMLInputElement {
  if (typeof candidate !== "object" || candidate === null) return false;

  const element = candidate as { tagName?: unknown; type?: unknown };
  return typeof element.tagName === "string"
    && element.tagName.toLowerCase() === "input"
    && element.type === "checkbox";
}

function isPresentationCheckbox(candidate: unknown): candidate is HTMLInputElement {
  if (!isNativeCheckbox(candidate)) return false;

  const dataset = (candidate as HTMLInputElement).dataset;
  return dataset !== undefined && dataset.presentationCheckbox === "true";
}

function readState(input: HTMLInputElement): CheckboxRuntimeState {
  if (input.indeterminate) return "intermediate";
  return input.checked ? "checked" : "unchecked";
}

function applyState(input: HTMLInputElement, state: CheckboxRuntimeState): void {
  switch (state) {
    case "unchecked":
      input.checked = false;
      input.indeterminate = false;
      input.setAttribute("aria-checked", "false");
      return;
    case "intermediate":
      input.checked = false;
      input.indeterminate = true;
      input.setAttribute("aria-checked", "mixed");
      return;
    case "checked":
      input.checked = true;
      input.indeterminate = false;
      input.setAttribute("aria-checked", "true");
      return;
  }
}

function getMode(input: HTMLInputElement): CheckboxMode {
  return input.dataset.presentationCheckboxMode === "three-state"
    ? "three-state"
    : "two-state";
}

function nextState(state: CheckboxRuntimeState, mode: CheckboxMode): CheckboxRuntimeState {
  if (mode === "three-state") {
    switch (state) {
      case "unchecked":
        return "intermediate";
      case "intermediate":
        return "checked";
      case "checked":
        return "unchecked";
    }
  }

  return state === "checked" ? "unchecked" : "checked";
}

function isCheckboxRuntimeState(value: unknown): value is CheckboxRuntimeState {
  return value === "unchecked" || value === "intermediate" || value === "checked";
}

function ensureCheckboxRuntime(
  input: HTMLInputElement,
  options?: CheckboxRuntimeOptions,
): CheckboxRuntimeInstance {
  const existing = checkboxInstances.get(input);
  if (existing !== undefined) {
    if (options !== undefined) existing.onChange = options.onChange;
    return existing;
  }

  const instance: CheckboxRuntimeInstance = {
    state: readState(input),
    onChange: options?.onChange,
    listener: () => undefined,
  };
  instance.listener = () => {
    instance.state = nextState(instance.state, getMode(input));
    applyState(input, instance.state);
    instance.onChange?.(input, instance.state);
  };

  applyState(input, instance.state);
  input.addEventListener("click", instance.listener);
  checkboxInstances.set(input, instance);
  return instance;
}

function hydrateCheckbox(input: HTMLInputElement, options?: CheckboxRuntimeOptions): void {
  ensureCheckboxRuntime(input, options);
}

export function hydrateCheckboxes(root: ParentNode, options?: CheckboxRuntimeOptions): void {
  const candidates = new Set<HTMLInputElement>();
  const rootElement = root as ParentNode & {
    matches?: (selector: string) => boolean;
  };

  if (rootElement.matches?.(checkboxSelector) && isPresentationCheckbox(root as Element)) {
    candidates.add(root as HTMLInputElement);
  }

  for (const candidate of root.querySelectorAll<Element>(checkboxSelector)) {
    if (isPresentationCheckbox(candidate)) candidates.add(candidate);
  }

  for (const candidate of candidates) hydrateCheckbox(candidate, options);
}

export function setCheckboxRuntimeState(
  input: HTMLInputElement,
  state: CheckboxRuntimeState,
): boolean {
  if (!isPresentationCheckbox(input) || !isCheckboxRuntimeState(state)) return false;

  const instance = ensureCheckboxRuntime(input);
  instance.state = state;
  applyState(input, state);
  return true;
}
