// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation, type PresentationFileResource } from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "../src/features/custom-library/custom-library-file";
import type { CustomLibraryFileRepository } from "../src/features/custom-library/custom-library-file-repository";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { CustomResourcesWorkspace } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const paletteRepository: CustomLibraryPaletteRepository = {
  savePalette: vi.fn(async () => "palette"), updatePalette: vi.fn(async () => undefined),
  listPalettes: vi.fn(async () => []), getPalette: vi.fn(async () => null), deletePalette: vi.fn(async () => undefined),
};

const fontRepository: CustomLibraryFontRepository = {
  saveFont: vi.fn(async () => "font"), updateFont: vi.fn(async () => undefined),
  listFonts: vi.fn(async () => []), getFont: vi.fn(async () => null), deleteFont: vi.fn(async () => undefined),
};

const libraryFile: CustomLibraryFileRecord = {
  id: "private-library-record",
  file: {
    name: "lesson-notes.txt",
    kind: "text",
    representation: "text",
    source: {
      assetId: "private-asset-id",
      storagePath: "private/storage/path",
      downloadUrl: "https://example.com/lesson-notes.txt",
      contentType: "text/plain",
      sizeBytes: 2048,
    },
  },
};

function repository(records: CustomLibraryFileRecord[] = [libraryFile]): CustomLibraryFileRepository {
  return {
    saveFile: vi.fn(async () => "new-file"),
    updateFile: vi.fn(async () => undefined),
    listFiles: vi.fn(async () => records),
    getFile: vi.fn(async () => null),
    deleteFile: vi.fn(async () => undefined),
  };
}

function presentationFiles(): PresentationFileResource[] {
  return [{
    id: "local-file-id",
    name: "local.png",
    kind: "image",
    representation: "binary",
    contentType: "image/png",
    source: { type: "url", url: "https://example.com/local.png" },
  }];
}

function makePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "files-resources",
    title: "Files",
    slides: [{ id: "slide", title: "Slide", elements: [] }],
  });
}

async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("Custom Resources Files", () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
  });

  function renderWorkspace(options: {
    fileRepository?: CustomLibraryFileRepository;
    files?: PresentationFileResource[];
    onAdd?: (file: CustomLibraryFileRecord["file"]) => Promise<"added" | "conflict" | "load-error">;
    onRemove?: (id: string) => void;
  } = {}): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<StudioI18nProvider><CustomResourcesWorkspace
      customLibraryPaletteRepository={paletteRepository}
      customLibraryFontRepository={fontRepository}
      customLibraryFileRepository={options.fileRepository ?? repository()}
      presentationColors={[]}
      presentationFonts={[]}
      presentationFiles={options.files}
      onAddLibraryPalette={() => ({ ok: true, addedColors: [] })}
      onAddLibraryFont={() => ({ kind: "unchanged", addedFaces: 0 })}
      onAddLibraryFile={options.onAdd}
      onApplyElementStyle={() => ({ ok: true })}
      onAddPresentationColor={() => undefined}
      onUpdatePresentationColor={() => undefined}
      onRemovePresentationColor={() => undefined}
      onRemovePresentationFont={() => "not-found"}
      onRemovePresentationFile={options.onRemove}
      isPresentationFontInUse={() => false}
    /></StudioI18nProvider>));
    return container;
  }

  it("loads library files, exposes loading/error/retry and adds without rendering private fields", async () => {
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    let resolveSecond: ((records: CustomLibraryFileRecord[]) => void) | undefined;
    const firstRequest = new Promise<CustomLibraryFileRecord[]>((_, reject) => { rejectFirst = reject; });
    const secondRequest = new Promise<CustomLibraryFileRecord[]>((resolve) => { resolveSecond = resolve; });
    const listFiles = vi.fn().mockReturnValueOnce(firstRequest).mockReturnValueOnce(secondRequest);
    const fileRepository = repository();
    fileRepository.listFiles = listFiles;
    const onAdd = vi.fn(async () => "added" as const);
    const container = renderWorkspace({ fileRepository, onAdd });

    const open = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "+ Add file");
    await act(async () => open?.click());
    expect(container.textContent).toContain("Loading files…");
    rejectFirst?.(new Error("offline"));
    await flush();
    expect(container.textContent).toContain("Could not load files.");

    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Retry");
    await act(async () => retry?.click());
    resolveSecond?.([libraryFile]);
    await flush();
    expect(container.textContent).toContain("lesson-notes.txt");
    expect(container.textContent).toContain("Text · 2 KB");
    expect(container.textContent).not.toContain(libraryFile.id);
    expect(container.textContent).not.toContain(libraryFile.file.source.assetId);
    expect(container.textContent).not.toContain(libraryFile.file.source.storagePath);

    const add = container.querySelector<HTMLButtonElement>("[aria-label='Add lesson-notes.txt']");
    await act(async () => add?.click());
    expect(onAdd).toHaveBeenCalledWith(libraryFile.file);
    await flush();
    expect(container.textContent).toContain("lesson-notes.txt added to this presentation.");
  });

  it("renders presentation-owned files with canonical metadata and removes by local ID", async () => {
    const onRemove = vi.fn();
    const fileRepository = repository([]);
    const container = renderWorkspace({ fileRepository, files: presentationFiles(), onRemove });

    expect(container.textContent).toContain("local.png");
    expect(container.textContent).toContain("Image · image/png");
    expect(container.textContent).not.toContain("https://example.com/local.png");
    expect(container.textContent).not.toContain("local-file-id");
    const remove = container.querySelector<HTMLButtonElement>("[aria-label='Remove local.png']");
    await act(async () => remove?.click());
    expect(onRemove).toHaveBeenCalledWith("local-file-id");
    expect(fileRepository.deleteFile).not.toHaveBeenCalled();
  });
});
