import { describe, expect, it } from "vitest";

import { escapeHtml } from "../src/escape-html";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(
      escapeHtml(
        `<script>alert("x" & 'y')</script>`,
      ),
    ).toBe(
      "&lt;script&gt;alert(&quot;x&quot; &amp; &#039;y&#039;)&lt;/script&gt;",
    );
  });

  it("keeps ordinary text unchanged", () => {
    expect(
      escapeHtml("PowerShow presentation"),
    ).toBe("PowerShow presentation");
  });

  it("handles empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });
});