import { describe, expect, it } from "vitest";

import {
  ElementLinkSchema,
  PowerShowElementSchema,
  isAbsoluteHttpHref,
} from "../src";

function textElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "PowerShow",
    ...overrides,
  };
}

function textboxElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "textbox",
    id: "textbox-1",
    hidden: false,
    content: "PowerShow",
    ...overrides,
  };
}

describe("isAbsoluteHttpHref URL validation policy", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "https://example.com/path/to/page",
    "https://example.com/search?q=links&page=2",
    "https://example.com/docs#section-3",
    "https://sub.example.co.uk:8443/path?a=1#frag",
  ] as const)("accepts absolute HTTP/HTTPS URL %s", (href) => {
    expect(isAbsoluteHttpHref(href)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "mailto:user@example.com",
    "tel:+1234567890",
    "ftp://example.com/file",
  ] as const)("rejects unsafe scheme %s", (href) => {
    expect(isAbsoluteHttpHref(href)).toBe(false);
  });

  it.each([
    "",
    "example.com",
    "www.example.com",
    "/relative/path",
    "docs/page",
    "https://",
    "http://",
    "https://exa mple.com",
    "not a url",
    "https:example.com",
    "http:example.com",
    " https://example.com ",
  ] as const)("rejects malformed or relative URL %s", (href) => {
    expect(isAbsoluteHttpHref(href)).toBe(false);
  });
});

describe("ElementLinkSchema", () => {
  it("accepts an https link with an explicit _self target", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "https://example.com",
      target: "_self",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        kind: "url",
        href: "https://example.com",
        target: "_self",
      });
    }
  });

  it("accepts a link without a target", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "https://example.com",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.target).toBeUndefined();
    }
  });

  it("rejects a link with an invalid target", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "https://example.com",
      target: "_parent",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a link with an unsafe scheme", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a link with a relative href", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "/docs",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a link with an empty href", () => {
    const result = ElementLinkSchema.safeParse({
      kind: "url",
      href: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("Text and Textbox element links", () => {
  it("accepts a Text element with a valid https link", () => {
    const result = PowerShowElementSchema.safeParse(
      textElement({
        link: {
          kind: "url",
          href: "https://example.com",
          target: "_blank",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "text",
        link: {
          kind: "url",
          href: "https://example.com",
          target: "_blank",
        },
      });
    }
  });

  it("accepts a Textbox element with a valid http link", () => {
    const result = PowerShowElementSchema.safeParse(
      textboxElement({
        link: {
          kind: "url",
          href: "http://example.com",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "textbox",
        link: {
          kind: "url",
          href: "http://example.com",
        },
      });
    }
  });

  it("rejects a Text element with an unsafe link", () => {
    const result = PowerShowElementSchema.safeParse(
      textElement({
        link: {
          kind: "url",
          href: "data:text/html,<script>alert(1)</script>",
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a Textbox element with a malformed link", () => {
    const result = PowerShowElementSchema.safeParse(
      textboxElement({
        link: {
          kind: "url",
          href: "example.com",
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("still accepts Text and Textbox without a link (backward compatibility)", () => {
    expect(PowerShowElementSchema.safeParse(textElement()).success).toBe(true);

    expect(PowerShowElementSchema.safeParse(textboxElement()).success).toBe(
      true,
    );
  });
});

describe("no-link backward compatibility", () => {
  it("parses legacy Text elements without a link property", () => {
    const legacy = PowerShowElementSchema.parse(textElement());

    expect(legacy).not.toHaveProperty("link");
  });

  it("parses legacy Textbox elements without a link property", () => {
    const legacy = PowerShowElementSchema.parse(textboxElement());

    expect(legacy).not.toHaveProperty("link");
  });
});

describe("link parse/roundtrip", () => {
  it("roundtrips a linked Text element through JSON serialization", () => {
    const source = PowerShowElementSchema.parse(
      textElement({
        link: {
          kind: "url",
          href: "https://example.com/guide?page=1#start",
          target: "_blank",
        },
      }),
    );

    const restored = PowerShowElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });

  it("round-trips a linked Textbox element through JSON serialization", () => {
    const source = PowerShowElementSchema.parse(
      textboxElement({
        link: {
          kind: "url",
          href: "http://example.com",
          target: "_self",
        },
      }),
    );

    const restored = PowerShowElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });
});
