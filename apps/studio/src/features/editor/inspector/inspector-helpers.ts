const DEFAULT_PICKER_COLOR = "#f8fafc";

export function readAbsoluteNumber(
  value: string | number | undefined,
): number | "" {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.endsWith("px")) {
    const number = Number(value.slice(0, -2));

    return Number.isFinite(number) ? number : "";
  }

  return "";
}

export function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

export function readPickerColor(value: string | undefined): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return DEFAULT_PICKER_COLOR;
}
