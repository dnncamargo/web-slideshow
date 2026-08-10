const DEFAULT_PICKER_COLOR = "#f8fafc";

export function readPickerColor(value: string | undefined): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return DEFAULT_PICKER_COLOR;
}
