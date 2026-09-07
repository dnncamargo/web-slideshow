// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DocsPage } from "../src/app/docs/docs-page";
import { allDocsTopics, docsGroups } from "../src/app/docs/docs-content";
import { parseBlocksSource } from "@powershow/renderer";
import { analyzeMathSource } from "../../../packages/math-source/src";

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
      "Elementos e Inspector",
      "Guias avançados",
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
    expect(ids).toContain("element-interactive");
    expect(ids).toContain("plot-create");
    expect(ids).toContain("plot-language");
    expect(ids).toContain("plot-animation");
    expect(ids).toContain("plot-examples");
    expect(ids).toContain("scripted-create");
    expect(ids).toContain("scripted-code");
    expect(ids).toContain("scripted-ports");
    expect(ids).toContain("scripted-api");
    expect(ids).toContain("scripted-examples");
    expect(ids).toContain("scripted-security-guide");
    expect(ids).toContain("scripted-security");

    const elementGroup = docsGroups.find((group) => group.title === "Elementos e Inspector");
    expect(elementGroup?.topics.map((topic) => topic.title)).toEqual([
      "Text", "Container", "Image", "Gallery", "Code", "Terminal", "Table", "Topics", "Divider", "Embed", "Blocks", "Plot", "Scripted", "Interactive",
    ]);
    expect(findTopicText("element-interactive")).toContain("não possui Inspector dedicado");

    expect(findTopicText("scripted-api")).toContain("PowerShow.ports.onAction");
    expect(findTopicText("scripted-api")).toContain("PowerShow.ports.onInput");
    expect(findTopicText("scripted-api")).toContain("PowerShow.ports.report");
    expect(findTopicText("plot-language")).toContain("x^2 + y^2 = 1");

    for (const topic of elementGroup?.topics ?? []) {
      expect(topic.sections.some((section) => section.title === "Inspector")).toBe(true);
    }
  });

  it("renders semantic code blocks and Inspector tables", async () => {
    const plotButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Plot — Linguagem matemática");
    await act(async () => plotButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelectorAll("table").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("pre code").length).toBeGreaterThan(0);
    const equationTable = Array.from(container.querySelectorAll("table")).find((table) => table.textContent?.includes("Forma para o usuário"));
    expect(equationTable?.querySelector("th")?.textContent).toBe("Forma para o usuário");
  });

  it("keeps the public examples aligned with the real Blocks, Plot, and Scripted contracts", () => {
    const blocks = findTopic("element-blocks");
    const blocksExample = blocks?.sections.find((section) => section.title === "Exemplo básico")?.codeBlocks?.[0]?.code ?? "";
    expect(blocksExample).toContain("\\start");
    expect(blocksExample).toContain("\\scope");
    expect(blocksExample).toContain("\\statement");
    const blocksResult = parseBlocksSource(blocksExample);
    expect(blocksResult.ok).toBe(true);

    const plotExamples = findTopic("plot-examples");
    const multipleCurves = plotExamples?.sections.find((section) => section.title === "Múltiplas curvas no mesmo Plot")?.codeBlocks?.[0]?.code ?? "";
    const analysis = analyzeMathSource(multipleCurves);
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.equations).toHaveLength(3);

    const scripted = findTopicText("scripted-examples");
    expect(scripted).toContain("increment");
    expect(scripted).toContain("enabled");
    expect(scripted).toContain("level");
    expect(scripted).toContain("pulse");
    expect(scripted).toContain("PowerShow.ports.onAction");
    expect(scripted).toContain("PowerShow.ports.onInput");
    expect(scripted).toContain("PowerShow.ports.report");
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

function findTopicText(id: string): string {
  const topic = findTopic(id);
  return topic?.sections.flatMap((section) => [
    ...(section.paragraphs ?? []),
    ...(section.bullets ?? []),
    section.code ?? "",
    ...(section.codeBlocks?.map((block) => block.code) ?? []),
    ...(section.table?.rows.flatMap((row) => row) ?? []),
  ]).join(" ") ?? "";
}

function findTopic(id: string) {
  return allDocsTopics.find((candidate) => candidate.id === id);
}
