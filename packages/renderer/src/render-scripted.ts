import type {
  ScriptedElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalSurfaceStyle } from "./render-canonical-surface";

// ============================================================
// BEGIN: SCRIPTED SANDBOX
//
// Scripted renders authored HTML/CSS/JavaScript as a sandboxed
// iframe whose only sandbox token is allow-scripts. The sandbox is
// renderer-owned policy, never authored state, and is NOT
// configurable. It deliberately denies same-origin, forms, popups,
// downloads, top navigation, and storage access: the authored
// document is fully isolated from the PowerShow application origin.
//
// The srcdoc is a complete renderer-generated document. The CSP meta
// below is a fixed defense-in-depth policy layered on top of the
// sandbox. connect/frame/object sources are all 'none' and no
// http/https/* source is ever granted.
//
// Authored html/css/script are transported ONLY as data attribute
// values (JSON.stringify escaped through escapeHtml). The renderer
// never interpolates authored strings into the srcdoc markup or into
// renderer-owned <style>/<script> elements. This makes hostile
// closing-tag sequences such as </script>, </style>, or "</template>
// inert as data until the fixed bootstrap decodes them at runtime.
//
// The bootstrap itself is a fixed renderer-owned constant injected
// RAW into a literal inline <script> element (script content is raw
// text, so entity escaping would corrupt it). The constant contains
// no authored data and no literal "</script" sequence.
//
// SECURITY SCOPE: the sandbox is the primary boundary; the CSP is
// defense in depth. This renderer does NOT implement a general HTML
// sanitizer. Authored content is intentionally executable inside its
// own sandbox.
// ============================================================

// The ONLY sandbox permission Scripted may receive.
const SCRIPTED_SANDBOX = "allow-scripts";

// Referrer isolation: the Scripted document must never receive or
// transmit an HTTP Referer derived from the PowerShow origin.
const SCRIPTED_REFERRERPOLICY = "no-referrer";

// Renderer-owned fixed CSP. Never authored, never configurable, and
// serialized with a stable ordering so the exact rendered document is
// deterministic. The browser decodes the escapeHtml'd attribute value
// back to this exact string.
const SCRIPTED_CSP =
  "default-src 'none';" +
  "script-src 'unsafe-inline';" +
  "style-src 'unsafe-inline';" +
  "img-src data: blob:;" +
  "media-src data: blob:;" +
  "font-src data:;" +
  "connect-src 'none';" +
  "frame-src 'none';" +
  "object-src 'none';" +
  "base-uri 'none';" +
  "form-action 'none';";

// The fixed bootstrap that runs inside the sandbox. It is a
// renderer-owned constant: it contains NO interpolation of authored
// html/css/script, and it contains no literal "</script" sequence.
//
// Order of operations inside the sandbox:
// 1. resolve the payload element;
// 2. resolve the Scripted root;
// 3. decode html/css/script from the payload attributes;
// 4. apply HTML to the Scripted root;
// 5. create a <style> element and assign CSS through textContent;
// 6. append the style to document.head;
// 7. create a <script> element and assign canonical script through
//    textContent;
// 8. append it only after HTML and CSS exist;
// 9. remove the temporary payload node.
//
// No eval(), no Function(), no setTimeout(string), no document.write.
const SCRIPTED_BOOTSTRAP_SOURCE =
  "(() => {" +
  "\n" +
  "var payload = document.getElementById('powershow-scripted-payload');" +
  "\n" +
  "if (!payload) { return; }" +
  "\n" +
  "var root = document.getElementById('powershow-scripted-root');" +
  "\n" +
  "if (!root) { return; }" +
  "\n" +
  "function decode(name) {" +
  "\n" +
  "  var serialized = payload.getAttribute('data-' + name);" +
  "\n" +
  "  try { return JSON.parse(serialized); }" +
  "\n" +
  "  catch (_error) { return ''; }" +
  "\n" +
  "}" +
  "\n" +
  "var html = String(decode('html'));" +
  "\n" +
  "var css = String(decode('css'));" +
  "\n" +
  "var script = String(decode('script'));" +
  "\n" +
  "root.innerHTML = html;" +
  "\n" +
  "if (css !== '') {" +
  "\n" +
  "  var styleNode = document.createElement('style');" +
  "\n" +
  "  styleNode.textContent = css;" +
  "\n" +
  "  document.head.appendChild(styleNode);" +
  "\n" +
  "}" +
  "\n" +
  "if (script !== '') {" +
  "\n" +
  "  var scriptNode = document.createElement('script');" +
  "\n" +
  "  scriptNode.textContent = script;" +
  "\n" +
  "  document.body.appendChild(scriptNode);" +
  "\n" +
  "}" +
  "\n" +
  "payload.remove();" +
  "\n" +
  "})();";

function serializedPayloadValue(value: string): string {
  // JSON.stringify keeps the exact authored string byte-for-byte;
  // escapeHtml then makes every quote/angle character inert inside
  // the quoted data attribute, so authored sequences can never
  // terminate renderer-owned markup.
  return escapeHtml(JSON.stringify(value));
}

// A complete deterministic document. Authored strings appear only in
// the payload template's data attributes; the inline bootstrap script
// is the unmodified renderer constant.
function buildScriptedDocument(
  element: ScriptedElement,
): string {
  return (
    "<!doctype html><html><head>" +
    "<meta charset=\"utf-8\">" +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"" +
    escapeHtml(SCRIPTED_CSP) +
    "\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" +
    escapeHtml(element.title) +
    "</title>" +
    "</head><body>" +
    "<div id=\"powershow-scripted-root\"></div>" +
    "<template id=\"powershow-scripted-payload\"" +
    " data-html=\"" +
    serializedPayloadValue(element.html) +
    "\"" +
    " data-css=\"" +
    serializedPayloadValue(element.css) +
    "\"" +
    " data-script=\"" +
    serializedPayloadValue(element.script) +
    "\"></template>" +
    "<script data-powershow-scripted-bootstrap=\"true\">" +
    SCRIPTED_BOOTSTRAP_SOURCE +
    "</script>" +
    "</body></html>"
  );
}

export function renderScripted(
  element: ScriptedElement,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-scripted",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const styles: string[] = [
    "display:block",
  ];

  const baseStyle = renderCanonicalSurfaceStyle(element);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  // The browser iframe default is a visible border. When no canonical
  // border is authored, the renderer collapses it so the Scripted box
  // matches other PowerShow elements. An authored border remains
  // authoritative and is never overridden.
  if (element.style?.border === undefined) {
    styles.push("border:0");
  }

  return (
    `<iframe` +
    ` class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="scripted"` +
    ` title="${escapeHtml(element.title)}"` +
    ` sandbox="${SCRIPTED_SANDBOX}"` +
    ` referrerpolicy="${SCRIPTED_REFERRERPOLICY}"` +
    ` srcdoc="${escapeHtml(buildScriptedDocument(element))}"` +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `></iframe>`
  );
}
