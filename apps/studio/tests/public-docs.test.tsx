// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DocsPage } from "../src/app/docs/docs-page";
import { allDocsTopics, docsGroups } from "../src/app/docs/docs-content";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stylesSource = readFileSync("src/app/docs/docs.module.css", "utf8");

describe("public Docs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    window.location.hash = "";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(DocsPage));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.location.hash = "";
  });

  it("keeps the documentation hierarchy explicit and topic ids unique", () => {
    expect(docsGroups.map((group) => group.title)).toEqual([
      "Comece aqui",
      "Arquitetura",
      "Documento canônico",
      "Superfícies de produto",
      "Dados e publicação",
      "Live e tempo real",
      "Segurança",
      "Referência",
    ]);

    const ids = allDocsTopics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("overview");
    expect(ids).toContain("presentation-schema");
    expect(ids).toContain("live-identity");
    expect(ids).toContain("source-of-truth");
  });

  it("opens one selected topic in the reading pane and mirrors it in the hash", async () => {
    expect(container.querySelector("h1")?.textContent).toBe("Visão geral");

    const firestoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Firestore",
    );
    expect(firestoreButton).toBeDefined();

    await act(async () => {
      firestoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("h1")?.textContent).toBe("Firestore");
    expect(window.location.hash).toBe("#firestore");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Firestore");
  });

  it("can open a valid topic directly from the URL hash", async () => {
    await act(async () => root.unmount());
    window.location.hash = "#live-identity";
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(DocsPage));
    });

    expect(container.querySelector("h1")?.textContent).toBe("Identidade da sessão");
  });

  it("preserves the requested desktop contents-left and reading-right composition", () => {
    expect(stylesSource).toContain(
      "grid-template-columns: minmax(230px, 292px) minmax(0, 1fr)",
    );
    expect(stylesSource).toContain("position: sticky");
    expect(stylesSource).toContain("border-right: 1px solid");
  });

  it("exposes home and GitHub navigation without coupling Docs to Studio auth", () => {
    expect(container.querySelector('a[href="/"]')?.textContent).toBe("PowerShow");
    expect(
      container.querySelector('a[href="https://github.com/dnncamargo/web-slideshow"]')?.textContent,
    ).toBe("GitHub");
    expect(container.textContent).not.toContain("Sign in");
  });
});
