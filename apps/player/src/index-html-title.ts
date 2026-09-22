const instanceDisplayNamePlaceholder = "__INSTANCE_DISPLAY_NAME__";

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '\"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function transformPlayerIndexHtml(html: string, displayName: string): string {
  return html.replace(
    `<title>${instanceDisplayNamePlaceholder} Player</title>`,
    () => `<title>${escapeHtmlText(displayName)} Player</title>`,
  );
}
