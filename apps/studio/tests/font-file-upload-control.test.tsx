// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CustomLibraryFontAcquisition } from "../src/features/custom-library/custom-library-font-acquisition";
import { FontFileUploadControl } from "../src/features/fonts/components/font-file-upload-control";
import type { FontFamilyFaces } from "../src/features/fonts/font-acquisition-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const uploadManagedFontAssetMock = vi.hoisted(() => vi.fn());

vi.mock("../src/features/persistence/managed-asset-storage", () => ({
  uploadManagedFontAsset: uploadManagedFontAssetMock,
}));

const uploadResult = {
  assetId: "123e4567-e89b-42d3-a456-426614174000",
  storagePath: "users/user-1/assets/123e4567-e89b-42d3-a456-426614174000.ttf",
  downloadUrl: "https://store.public.blob.vercel-storage.com/users/user-1/assets/123e4567-e89b-42d3-a456-426614174000.ttf",
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
    uploadManagedFontAssetMock.mockReset();
    uploadManagedFontAssetMock.mockResolvedValue(uploadResult);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function mount(
    fontFamilies: readonly FontFamilyFaces[] = [],
    onAddFontFace = vi.fn().mockResolvedValue(true),
    onPhysicalUpload = vi.fn(),
  ) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <FontFileUploadControl
            fontFamilies={fontFamilies}
            onAddFontFace={onAddFontFace}
            onFontAdded={vi.fn()}
            onPhysicalUpload={onPhysicalUpload}
            controlPrefix="font-upload"
          />
        </StudioI18nProvider>,
      );
    });
    return { onAddFontFace, onPhysicalUpload };
  }

  it("uploads TTF with the canonical type and creates a truetype face", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    const onPhysicalUpload = vi.fn();
    mount([], onAddFontFace, onPhysicalUpload);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(uploadManagedFontAssetMock).toHaveBeenCalledWith(
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
      expect.any(String),
      { kind: "managed-upload", assetId: uploadResult.assetId },
    );
    expect(onPhysicalUpload).toHaveBeenCalledOnce();
  });

  it("notifies immediately after physical upload even when persistence fails", async () => {
    const events: string[] = [];
    const onAddFontFace = vi.fn().mockImplementation(async () => {
      events.push("persist");
      return { status: "persistence-failed" } as const;
    });
    const onPhysicalUpload = vi.fn(() => events.push("upload"));
    mount([], onAddFontFace, onPhysicalUpload);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(onPhysicalUpload).toHaveBeenCalledOnce();
    expect(events).toEqual(["upload", "persist"]);
    expect(container.textContent).toContain("Retry saving");
  });

  it("accepts WOFF2 filenames case-insensitively", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.WOFF2"));

    await act(async () => click(container, "font-upload-submit"));

    expect(uploadManagedFontAssetMock).toHaveBeenCalledWith(
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

  it("accepts OTF filenames case-insensitively", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    mount([], onAddFontFace);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.OTF"));

    await act(async () => click(container, "font-upload-submit"));

    expect(uploadManagedFontAssetMock).toHaveBeenCalledWith(
      expect.any(File),
      { contentType: "font/otf" },
    );
    expect(onAddFontFace).toHaveBeenCalledWith(
      "My Font",
      expect.objectContaining({
        source: {
          type: "url",
          url: uploadResult.downloadUrl,
          format: "opentype",
        },
      }),
      expect.any(String),
      { kind: "managed-upload", assetId: uploadResult.assetId },
    );
  });

  it("accepts the supported font file types and excludes unsupported ones", () => {
    mount();

    const input = container.querySelector<HTMLInputElement>("#font-upload-file");
    if (!input) throw new Error("font file input not found");
    const acceptedTypes = input.accept.split(",");

    expect(acceptedTypes).toEqual(
      expect.arrayContaining([
        ".ttf",
        ".otf",
        ".woff2",
        "font/ttf",
        "font/otf",
        "font/woff2",
      ]),
    );
    expect(acceptedTypes).not.toContain(".woff");
    expect(acceptedTypes).not.toContain("font/woff");
  });

  it.each(["font.woff", "font.zip"])(
    "rejects unsupported extension %s before upload",
    async (name) => {
      const onAddFontFace = vi.fn().mockResolvedValue(true);
      const onPhysicalUpload = vi.fn();
      mount([], onAddFontFace, onPhysicalUpload);
      setInputValue(container, "font-upload-family", "My Font");
      setFileValue(container, "font-upload-file", makeFile(name));

      await act(async () => click(container, "font-upload-submit"));

      expect(container.textContent).toContain(
        "Only .ttf, .otf and .woff2 files are supported.",
      );
      expect(uploadManagedFontAssetMock).not.toHaveBeenCalled();
      expect(onPhysicalUpload).not.toHaveBeenCalled();
      expect(onAddFontFace).not.toHaveBeenCalled();
    },
  );

  it("requires family and file before upload", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    const onPhysicalUpload = vi.fn();
    mount([], onAddFontFace, onPhysicalUpload);

    await act(async () => click(container, "font-upload-submit"));
    expect(container.textContent).toContain("Enter a font family.");
    expect(uploadManagedFontAssetMock).not.toHaveBeenCalled();
    expect(onPhysicalUpload).not.toHaveBeenCalled();

    setInputValue(container, "font-upload-family", "My Font");
    await act(async () => click(container, "font-upload-submit"));
    expect(container.textContent).toContain("Choose a font file.");
    expect(uploadManagedFontAssetMock).not.toHaveBeenCalled();
    expect(onPhysicalUpload).not.toHaveBeenCalled();
  });

  it("preflights an occupied family face slot before upload", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    const onPhysicalUpload = vi.fn();
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
    ], onAddFontFace, onPhysicalUpload);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(container.textContent).toContain("This font face already exists.");
    expect(uploadManagedFontAssetMock).not.toHaveBeenCalled();
    expect(onPhysicalUpload).not.toHaveBeenCalled();
    expect(onAddFontFace).not.toHaveBeenCalled();
  });

  it("shows a safe retryable error when managed storage fails", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    const onPhysicalUpload = vi.fn();
    uploadManagedFontAssetMock.mockRejectedValueOnce(new Error("raw Firebase secret"));
    mount([], onAddFontFace, onPhysicalUpload);
    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));

    await act(async () => click(container, "font-upload-submit"));

    expect(container.textContent).toContain("The upload failed. Check the file and try again.");
    expect(container.textContent).not.toContain("raw Firebase secret");
    expect(onAddFontFace).not.toHaveBeenCalled();
    expect(onPhysicalUpload).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>("#font-upload-family")?.value).toBe(
      "My Font",
    );
  });

  it("retries persistence with the same uploaded URL without uploading twice", async () => {
    const onAddFontFace = vi.fn().mockResolvedValueOnce({ status: "persistence-failed" });
    const onRetryFontFacePersistence = vi.fn().mockResolvedValue({ status: "saved" });
    const onFontAdded = vi.fn();
    const onPhysicalUpload = vi.fn();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <FontFileUploadControl
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onRetryFontFacePersistence={onRetryFontFacePersistence}
            onFontAdded={onFontAdded}
            onPhysicalUpload={onPhysicalUpload}
            controlPrefix="font-upload"
          />
        </StudioI18nProvider>,
      );
    });

    setInputValue(container, "font-upload-family", "My Font");
    setFileValue(container, "font-upload-file", makeFile("MyFont.ttf"));
    await act(async () => click(container, "font-upload-submit"));
    expect(container.textContent).toContain("Retry saving");
    const initialPersistenceId = onAddFontFace.mock.calls[0]?.[2];
    expect(initialPersistenceId).toEqual(expect.any(String));

    await act(async () => click(container, "font-upload-submit"));
    expect(uploadManagedFontAssetMock).toHaveBeenCalledOnce();
    expect(onPhysicalUpload).toHaveBeenCalledOnce();
    expect(onRetryFontFacePersistence).toHaveBeenCalledWith(
      "My Font",
      expect.objectContaining({ source: expect.objectContaining({ url: uploadResult.downloadUrl }) }),
      initialPersistenceId,
      { kind: "managed-upload", assetId: uploadResult.assetId },
    );
    expect(onFontAdded).toHaveBeenCalledWith("My Font");
  });
});

describe("Custom Library font upload integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    uploadManagedFontAssetMock.mockReset();
    uploadManagedFontAssetMock.mockResolvedValue(uploadResult);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("routes Upload file through the existing onAddFontFace writer", async () => {
    const onAddFontFace = vi.fn().mockResolvedValue(true);
    const onPhysicalUpload = vi.fn();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <CustomLibraryFontAcquisition
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onPhysicalUpload={onPhysicalUpload}
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
      expect.any(String),
      { kind: "managed-upload", assetId: uploadResult.assetId },
    );
    expect(container.textContent).toContain("Added My Font.");
    expect(onPhysicalUpload).toHaveBeenCalledOnce();
  });

  it("does not notify for non-physical font registrations", async () => {
    const onPhysicalUpload = vi.fn();
    const onAddFontFace = vi.fn().mockResolvedValue(true);

    act(() => {
      root.render(
        <StudioI18nProvider>
          <CustomLibraryFontAcquisition
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onPhysicalUpload={onPhysicalUpload}
            onClose={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });

    expect(uploadManagedFontAssetMock).not.toHaveBeenCalled();
    expect(onPhysicalUpload).not.toHaveBeenCalled();
  });
});
