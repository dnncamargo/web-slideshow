import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ verifyFirebaseIdToken: vi.fn() }));
const intentMocks = vi.hoisted(() => ({ createManagedAssetIntent: vi.fn() }));

vi.mock("../src/features/auth/firebase-admin-auth", () => authMocks);
vi.mock("../src/features/persistence/managed-asset-intents", () => ({
  ...intentMocks,
  listManagedAssetIntents: vi.fn(),
}));

import { POST as createGenericIntent } from "../src/app/api/managed-assets/intents/route";
import { POST as createFontIntent } from "../src/app/api/managed-assets/fonts/intents/route";

const id = "123e4567-e89b-12d3-a456-426614174000";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/managed-assets/intents", {
    method: "POST",
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function input(extension: string, contentType: string) {
  return {
    assetId: id,
    originalFilename: `asset${extension}`,
    extension,
    contentType,
    expectedSizeBytes: 12,
    sourceLastModified: 100,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.verifyFirebaseIdToken.mockResolvedValue({ uid: "owner" });
  intentMocks.createManagedAssetIntent.mockImplementation(async (_uid: string, value: unknown, purpose: string) => ({
    ...(value as Record<string, unknown>),
    purpose,
  }));
});

describe("managed asset intent routes", () => {
  it.each([
    [".ttf", "font/ttf"],
    [".otf", "font/otf"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
  ])("rejects a generic intention for %s at the server", async (extension, contentType) => {
    intentMocks.createManagedAssetIntent.mockRejectedValueOnce(new Error("invalid_type"));
    const response = await createGenericIntent(request(input(extension, contentType)));
    expect(response.status).toBe(400);
    expect(intentMocks.createManagedAssetIntent).toHaveBeenCalledWith("owner", input(extension, contentType), "generic");
  });

  it.each([
    [".ttf", "font/ttf"],
    [".otf", "font/otf"],
    [".woff2", "font/woff2"],
  ])("creates dedicated Fonts intent for supported format %s", async (extension, contentType) => {
    const response = await createFontIntent(request(input(extension, contentType)));
    expect(response.status).toBe(201);
    expect(intentMocks.createManagedAssetIntent).toHaveBeenCalledWith("owner", input(extension, contentType), "fonts");
  });

  it("does not accept .woff through the Fonts endpoint", async () => {
    intentMocks.createManagedAssetIntent.mockRejectedValueOnce(new Error("invalid_type"));
    const response = await createFontIntent(request(input(".woff", "font/woff")));
    expect(response.status).toBe(400);
  });

  it("does not accept a browser-supplied purpose override on either route", async () => {
    const response = await createGenericIntent(request({ ...input(".png", "image/png"), purpose: "fonts" }));
    expect(response.status).toBe(400);
    expect(intentMocks.createManagedAssetIntent).not.toHaveBeenCalled();
  });
});
