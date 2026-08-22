import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

// Scripted is deliberately rendered as a non-executing placeholder until
// P10.9-B implements the secure renderer. These tests prove the placeholder
// never emits the authored html, css, or script payloads.

const AUTHORED_HTML =
  '<section class="authored-html"><script>alert("xss")</script></section>';

const AUTHORED_CSS = ".authored-css { color: red; }";

const AUTHORED_SCRIPT = 'console.log("authored-script"); alert(1);';

describe("renderElement scripted placeholder", () => {
  it("renders the existing placeholder representation when visible", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-1",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    const html = renderElement(element);

    expect(html).toContain("powershow-placeholder");

    expect(html).toContain("powershow-placeholder-scripted");

    expect(html).toContain("[scripted]");
  });

  it("preserves the data-powershow-id attribute", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "signal-42",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    expect(renderElement(element)).toContain('data-powershow-id="signal-42"');
  });

  it("emits data-powershow-type=\"scripted\"", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-3",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    expect(renderElement(element)).toContain('data-powershow-type="scripted"');
  });

  it("never inserts authored HTML into the output", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-4",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    const html = renderElement(element);

    expect(html).not.toContain("authored-html");

    expect(html).not.toContain("<section>");

    expect(html).not.toContain("<script>");
  });

  it("never inserts authored CSS into the output", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-5",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    expect(renderElement(element)).not.toContain("authored-css");
  });

  it("never inserts authored script into the output", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-6",
      hidden: false,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    const html = renderElement(element);

    expect(html).not.toContain("authored-script");

    expect(html).not.toContain("alert(1)");
  });

  it("renders an empty string when hidden", () => {
    const element: PowerShowElement = {
      type: "scripted",
      id: "scripted-hidden",
      hidden: true,
      title: "Signal generator",
      html: AUTHORED_HTML,
      css: AUTHORED_CSS,
      script: AUTHORED_SCRIPT,
    };

    expect(renderElement(element)).toBe("");
  });
});