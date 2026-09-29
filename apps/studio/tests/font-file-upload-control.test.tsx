// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CustomLibraryFontAcquisition } from "../src/features/custom-library/custom-library-font-acquisition";
import { FontFileUploadControl } from "../src/features/fonts/components/font-file-upload-control";
import type { FontFamilyFaces } from "../src/features/fonts/font-acquisition-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const uploadManagedAssetMock = vi.hoisted(() => vi.fn());

vi.mock("../src/features/persistence/managed-asset-storage", () => ({
  uploadManagedAsset: uploadManagedAssetMock,
}));

const uploadResult = {
  assetId: "asset-1",
  storagePath: "users/user-1/assets/asset-1",
  downloadUrl: "https://firebasestorage.googleapis.com/download/asset-1",
  contentType: "font/ttf",
  sizeBytes: 12,
};

function makeFile(name: string, type = "application/octet-stream"): File {
  return new File(["font-data"], name, { type });
}

function setInputValue(container: HTMLElement, id: string, value: string) {
  act(() => {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`input ${id} not found`);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("input value setter not found");
    setter.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setFileValue(container: HTMLElement, id: string, file: File) {
  act(() => {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`input ${id} not found`);
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function click(container: HTMLElement, id: string) {
  const button = container.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) throw new Error(`button ${id} not found`);
  button.click();
}

describe("FontFileUploadControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    uploadManagedAssetMock.mockReset();
    uploadManagedAssetMock.mockResolvedValue(uploadResult);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function mount(
    fontFamilies: readonly FontFamilyFaces[] = [],
    onAddFontFace = vi.fn().mockResolvedValue(true),
  ) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <FontFileUploadControl
            fontFamilies={fontFamilies}
            onAddFontFace={onAddFontFace}
            onFontAdded={vi.fn()}
            controlPrefix="font-upload"
          />
        </StudioI18nProvider>,
      );
    });
    return { onAddFontFace };
  }

  it("uploads TTF with the canonical type and creates a truetype face", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(uploadManagedAssetMock).toHaveBeenCalledWith(
      expect.any(File),
      { contentType: "font/ttf" },
    );
    expect(onAddFontFace).toHaveBeenCalledWith(
      "My Font",
      expect.objectContaining({
        weight: 400,
        style: "normal",
        source: {
          type: "url",
          url: uploadResult.downloadUrl,
          format: "truetype",
        },
      }),
    );
  });

  it("accepts WOFF2 filenames case-insensitively", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.WOFF2"));

    await act(async () => click(container, "font-upload-submit"));

    expect(uploadManagedAssetMock).toHaveBeenCalledWith(
      expect.any(File),
      { contentType: "font/woff2" },
    );
    expect(onAddFontFace.mock.calls[0]?.[1]).toMatchObject({
      source: {
        url: uploadResult.downloadUrl,
        format: "woff2",
      },
    });
  });

  it.each(["font.otf", "font.woff", "font.zip"])(
    "rejects unsupported extension %s before upload",
    async (name) => {
      const onAddFontFace = vi.fn().mockResolvedValue(true);
      mount([], onAddFontFace);
      setInputValue(container, "font-upload-family", "My Font");
      setFileValue(container, "font-upload-file", makeFile(name));

      await act(async () => click(container, "font-upload-submit"));

      expect(container.textContent).toContain(
        "Only .ttf and .woff2 files are supported.",
      );
      expect(uploadManagedAssetMock).not.toHaveBeenCalled();
      expect(onAddFontFace).not.toHaveBeenCalled();
    },
  );

  it("requires family and file before upload", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([], onAddFontFace);

    await act(async () => click(container, "font-upload-submit"));
    expect(container.textContent).toContain("Enter a font family.");
    expect(uploadManagedAssetMock).not.toHaveBeenCalled();

    setInputValue(container, "font-upload-family", "My Font");
    await act(async () => click(container, "font-upload-submit"));
    expect(container.textContent).toContain("Choose a font file.");
    expect(uploadManagedAssetMock).not.toHaveBeenCalled();
  });

  it("preflights an occupied family face slot before upload", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([
      {
        family: "  my font ",
        faces: [
          {
            weight: 400,
            style: "normal",
            source: { type: "url", url: "https://example.test/existing.ttf" },
          },
        ],
      },
    ], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(container.textContent).toContain("This font face already exists.");
    expect(uploadManagedAssetMock).not.toHaveBeenCalled();
    expect(onAddFontFace).not.toHaveBeenCalled();
  });

  it("shows a safe retryable error when managed storage fails", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    uploadManagedAssetMock.mockRejectedValueOnce(new Error("raw Firebase secret"));
    mount([], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(container.textContent).toContain("Could not upload the font file.");
    expect(container.textContent).not.toContain("raw Firebase secret");
    expect(onAddFontFace).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>("#font-upload-family")?.value).toBe(
      "My Font",
    );
  });
});

describe("Custom Library font upload integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    uploadManagedAssetMock.mockReset();
    uploadManagedAssetMock.mockResolvedValue(uploadResult);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("routes Upload file through the existing onAddFontFace writer", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);

    act(() => {
      root.render(
        <StudioI18nProvider>
          <CustomLibraryFontAcquisition
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onClose={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });

    const source = container.querySelector<HTMLSelectElement>(
      "#custom-library-font-source",
    );
    if (!source) throw new Error("font source selector not found");
    act(() => {
      source.value = "upload";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });

    setInputValue(container, "custom-library-font-family", "My Font");
    setFileValue(
      container,
      "custom-library-font-file",
      makeFile("MyFont.ttf"),
    );

    await act(async () => click(container, "custom-library-font-submit"));

    expect(onAddFontFace).toHaveBeenCalledWith(
      "My Font",
      expect.objectContaining({
        source: expect.objectContaining({ format: "truetype" }),
      }),
    );
    expect(container.textContent).toContain("Added My Font.");
  });
});
