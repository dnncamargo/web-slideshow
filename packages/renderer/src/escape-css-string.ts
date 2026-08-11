const CSS_STRING_ESCAPE_PATTERN = /[\u0000-\u001f\u007f"\\<>]/g;

export function quoteCssString(value: string): string {
  return `"${value.replace(CSS_STRING_ESCAPE_PATTERN, (character) => {
    const codePoint = character.charCodeAt(0);

    return `\\${codePoint === 0 ? "fffd" : codePoint.toString(16)} `;
  })}"`;
}
