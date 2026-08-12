export function getControlName(prefix: string, field: string): string {
  return `${prefix}${field}`;
}

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
