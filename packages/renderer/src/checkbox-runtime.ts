type CheckboxRuntimeState = "unchecked" | "intermediate" | "checked";
type CheckboxMode = "two-state" | "three-state";

interface CheckboxRuntimeInstance {
  state: CheckboxRuntimeState;
  listener: () => void;
}

const checkboxInstances = new WeakMap<HTMLInputElement, CheckboxRuntimeInstance>();
const checkboxSelector = '[data-presentation-checkbox="true"]';

function isNativeCheckbox(candidate: Element): candidate is HTMLInputElement {
  return candidate.tagName.toLowerCase() === "input"
    && (candidate as HTMLInputElement).type === "checkbox";
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

function hydrateCheckbox(input: HTMLInputElement): void {
  if (checkboxInstances.has(input)) return;

  const instance: CheckboxRuntimeInstance = {
    state: readState(input),
    listener: () => undefined,
  };
  instance.listener = () => {
    instance.state = nextState(instance.state, getMode(input));
    applyState(input, instance.state);
  };

  applyState(input, instance.state);
  input.addEventListener("click", instance.listener);
  checkboxInstances.set(input, instance);
}

export function hydrateCheckboxes(root: ParentNode): void {
  const candidates = new Set<HTMLInputElement>();
  const rootElement = root as ParentNode & {
    matches?: (selector: string) => boolean;
  };

  if (rootElement.matches?.(checkboxSelector) && isNativeCheckbox(root as Element)) {
    candidates.add(root as HTMLInputElement);
  }

  for (const candidate of root.querySelectorAll<Element>(checkboxSelector)) {
    if (isNativeCheckbox(candidate)) candidates.add(candidate);
  }

  for (const candidate of candidates) hydrateCheckbox(candidate);
}
