const CSS_STRING_ESCAPE_PATTERN = /[\u0000-\u001f\u007f"\\<>]/g;
const CSS_DECLARATION_ESCAPE_PATTERN =
  /[\u0000-\u001f\u007f"'\\;{}<>/*]/g;

function escapeCssCharacter(character: string): string {
  const codePoint = character.charCodeAt(0);

  return `\\${codePoint === 0 ? "fffd" : codePoint.toString(16)} `;
}

export function quoteCssString(value: string): string {
  return `"${value.replace(CSS_STRING_ESCAPE_PATTERN, escapeCssCharacter)}"`;
}

export function escapeCssDeclarationValue(value: string): string {
  return value.replace(CSS_DECLARATION_ESCAPE_PATTERN, escapeCssCharacter);
}
