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

function imageElement(overrides: Record<string, unknown> = {}) {
  return {
    type: "image",
    id: "image-1",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
    ...overrides,
  };
}

function containerElement(overrides: Record<string, unknown> = {}) {
  return {
  type: "container",
  id: "container-1",
  hidden: false,
  children: [],
  ...overrides
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

describe("Text and Container element links", () => {
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

  it("accepts a Text element without a link", () => {
    expect(PowerShowElementSchema.safeParse(textElement()).success).toBe(true);
  });

  it("rejects a legacy Textbox element", () => {
    const result = PowerShowElementSchema.safeParse({
      type: "textbox",
      id: "textbox-1",
      content: "legacy",
    });

    expect(result.success).toBe(false);
  });

  it("validates the canonical Container + Text composition", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        children: [
          textElement({
            id: "child-text",
            content: "A highlighted explanation",
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "container",
        children: [{ type: "text", id: "child-text" }],
      });
    }
  });
});

describe("Image element links", () => {
  it("accepts an Image element with a valid https link", () => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "image",
        link: {
          kind: "url",
          href: "https://example.com/photo",
        },
      });
    }
  });

  it("accepts an Image element with a valid http link", () => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href: "http://example.com/photo",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "image",
        link: {
          kind: "url",
          href: "http://example.com/photo",
        },
      });
    }
  });

  it("accepts an Image element link with an explicit _self target", () => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_self",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "image",
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_self",
        },
      });
    }
  });

  it("accepts an Image element link with a _blank target", () => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_blank",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
        type: "image",
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_blank",
        },
      });
    }
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ] as const)("rejects unsafe Image link scheme %s", (href) => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href,
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it.each([
    "example.com",
    "/relative/path",
    " https://example.com ",
  ] as const)("rejects malformed Image link URL %s", (href) => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href,
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an Image element link with an invalid target", () => {
    const result = PowerShowElementSchema.safeParse(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_parent",
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("still accepts an Image without a link (backward compatibility)", () => {
    expect(PowerShowElementSchema.safeParse(imageElement()).success).toBe(true);
  });
});

describe("Container element links", () => {
  it("accepts a Container with a valid https link", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
  type: "container",
  link: {
          kind: "url",
          href: "https://example.com/hero",
        }
});
    }
  });

  it("accepts a Container with a valid http link", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "http://example.com/hero",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
  type: "container",
  link: {
          kind: "url",
          href: "http://example.com/hero",
        }
});
    }
  });

  it("accepts a Container link with an explicit _self target", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_self",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
  type: "container",
  link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_self",
        }
});
    }
  });

  it("accepts a Container link with a _blank target", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_blank",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toMatchObject({
  type: "container",
  link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_blank",
        }
});
    }
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ] as const)("rejects unsafe Container link scheme %s", (href) => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href,
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it.each([
    "example.com",
    "/relative/path",
    " https://example.com ",
  ] as const)("rejects malformed Container link URL %s", (href) => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href,
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a Container link with an invalid target", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_parent",
        },
      }),
    );

    expect(result.success).toBe(false);
  });

  it("still accepts a Container without a link (backward compatibility)", () => {
    const result = PowerShowElementSchema.safeParse(containerElement());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).not.toHaveProperty("link");
    }
  });

  it("allows nested Containers to independently carry their own links", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/outer",
        },
        children: [
          containerElement({
            id: "inner-1",
            link: {
              kind: "url",
              href: "https://example.com/inner",
            },
          }),
          containerElement({
            id: "inner-2",
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      const outer = result.data as {
        link: { kind: "url"; href: string };
        children: Array<{ link?: { kind: "url"; href: string } }>;
      };

      expect(outer.link).toMatchObject({
        kind: "url",
        href: "https://example.com/outer",
      });

      const children = outer.children;

      expect(children[0]?.link).toMatchObject({
        kind: "url",
        href: "https://example.com/inner",
      });

      expect(children[1]?.link).toBeUndefined();
    }
  });

  it("keeps child Text and Image links canonical inside a linked Container", () => {
    const result = PowerShowElementSchema.safeParse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/outer",
        },
        children: [
          textElement({
            id: "child-text",
            link: {
              kind: "url",
              href: "https://example.com/text",
            },
          }),
          imageElement({
            id: "child-image",
            link: {
              kind: "url",
              href: "https://example.com/image",
            },
          }),
        ],
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      const container = result.data as {
        link: { href: string };
        children: Array<{ id: string; link: { href: string } }>;
      };

      expect(container.link.href).toBe("https://example.com/outer");

      expect(container.children.find((c) => c.id === "child-text")?.link.href).toBe(
        "https://example.com/text",
      );

      expect(
        container.children.find((c) => c.id === "child-image")?.link.href,
      ).toBe("https://example.com/image");
    }
  });
});

describe("unsupported element types and links", () => {
  it.each([
    ["chart", { type: "chart", id: "chart-1", hidden: false, source: "" }],
    ["interactive", { type: "interactive", id: "int-1", hidden: false, widget: "function-plot", config: {} }],
  ] as const)(
    "rejects a link property from a %s element per schema strictness conventions",
    (_type, element) => {
      const result = PowerShowElementSchema.safeParse({
        ...element,
        link: {
          kind: "url",
          href: "https://example.com",
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["code", { type: "code", id: "code-1", hidden: false, code: "x" }],
    ["terminal", { type: "terminal", id: "term-1", hidden: false, lines: [] }],
    ["table", { type: "table", id: "table-1", hidden: false, columns: [], rows: [] }],
  ] as const)("rejects a link property from a canonical %s element", (_type, element) => {
    expect(PowerShowElementSchema.safeParse({ ...element, link: { kind: "url", href: "https://example.com" } }).success).toBe(false);
  });
});

describe("no-link backward compatibility", () => {
  it("parses legacy Text elements without a link property", () => {
    const legacy = PowerShowElementSchema.parse(textElement());

    expect(legacy).not.toHaveProperty("link");
  });

  it("parses legacy Container elements without a link property", () => {
    const legacy = PowerShowElementSchema.parse(containerElement());

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

  it("round-trips a linked Image element through JSON serialization", () => {
    const source = PowerShowElementSchema.parse(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo?size=large#crop",
          target: "_blank",
        },
      }),
    );

    const restored = PowerShowElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });

  it("roundtrips a linked Container element through JSON serialization", () => {
    const source = PowerShowElementSchema.parse(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero?from=home#top",
          target: "_self",
        },
        children: [
          textElement({
            id: "child-text",
            link: {
              kind: "url",
              href: "https://example.com/text",
            },
          }),
        ],
      }),
    );

    const restored = PowerShowElementSchema.parse(
      JSON.parse(JSON.stringify(source)),
    );

    expect(restored).toEqual(source);
  });
});
