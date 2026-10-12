import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlobUnknownError } from "@vercel/blob";

const blobMocks = vi.hoisted(() => ({
  handleUpload: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(),
}));
const intentMocks = vi.hoisted(() => ({
  authorizeManagedAssetUpload: vi.fn(),
  reconcileManagedAssetIntent: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: blobMocks.handleUpload,
}));

vi.mock("../src/features/auth/firebase-admin-auth", () => ({
  verifyFirebaseIdToken: authMocks.verifyFirebaseIdToken,
}));

vi.mock("../src/features/persistence/managed-asset-intents", () => intentMocks);

import { POST } from "../src/app/api/managed-assets/upload/route";
import { MANAGED_ASSET_EXTENSIONS } from "../src/features/persistence/managed-asset-content-types";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

type BeforeGenerateToken = (
  pathname: string,
  clientPayload: string | null,
  multipart: boolean,
) => Promise<unknown>;

let beforeGenerateToken: BeforeGenerateToken | undefined;

function payload(
  pathname: string,
  clientPayload: string | null,
): Record<string, unknown> {
  return {
    payload: {
      clientPayload,
      multipart: false,
      pathname,
    },
    type: "blob.generate-client-token",
  };
}

function request(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/managed-assets/upload", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function clientPayload(
  idToken = "firebase-id-token",
  contentType = "font/ttf",
): string {
  return JSON.stringify({
    idToken,
    contentType,
    assetId: "123e4567-e89b-12d3-a456-426614174000",
    expectedSizeBytes: 9,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  beforeGenerateToken = undefined;
  authMocks.verifyFirebaseIdToken.mockResolvedValue({ uid: "owner" });
  intentMocks.authorizeManagedAssetUpload.mockResolvedValue("authorized");
  intentMocks.reconcileManagedAssetIntent.mockResolvedValue({ status: "complete" });
  blobMocks.handleUpload.mockImplementation(
    async (options: { body: unknown; onBeforeGenerateToken: BeforeGenerateToken }) => {
      beforeGenerateToken = options.onBeforeGenerateToken;
      const body = options.body as {
        payload?: {
          clientPayload?: string | null;
          multipart?: boolean;
          pathname?: string;
        };
      };

      if (body.payload?.pathname && "clientPayload" in (body.payload ?? {})) {
        await options.onBeforeGenerateToken(
          body.payload.pathname,
          body.payload.clientPayload ?? null,
          body.payload.multipart ?? false,
        );
      }

      return { clientToken: "opaque-token", type: "blob.generate-client-token" };
    },
  );
});

describe("managed asset upload route", () => {
  it.each(Object.entries(MANAGED_ASSET_EXTENSIONS))("accepts supported managed-asset extension %s", async (extension, classification) => {
    const response = await POST(
      request(
        payload(
          `users/owner/assets/123e4567-e89b-12d3-a456-426614174000${extension}`,
          clientPayload("firebase-id-token", classification.contentType),
        ),
      ),
    );

    expect(response.status).toBe(200);
  });

  it("authorizes a non-anonymous Firebase user and constrains the Blob token MIME", async () => {
    const response = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload(),
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(authMocks.verifyFirebaseIdToken).toHaveBeenCalledWith(
      "firebase-id-token",
    );
    expect(beforeGenerateToken).toBeDefined();

    const policy = await beforeGenerateToken?.(
      "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.woff2",
      clientPayload("firebase-id-token", "font/woff2"),
      false,
    );

    expect(policy).toEqual({
      addRandomSuffix: false,
      allowOverwrite: false,
      allowedContentTypes: ["font/woff2"],
      maximumSizeInBytes: 9,
      tokenPayload: JSON.stringify({ uid: "owner", assetId: "123e4567-e89b-12d3-a456-426614174000" }),
    });
    expect(intentMocks.authorizeManagedAssetUpload).toHaveBeenCalledWith(
      "owner",
      "123e4567-e89b-12d3-a456-426614174000",
      "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.woff2",
      "font/woff2",
      9,
    );
  });

  it("rejects a forged or mismatched intent before issuing a Blob token", async () => {
    intentMocks.authorizeManagedAssetUpload.mockRejectedValueOnce(new Error("intent_mismatch"));
    const response = await POST(request(payload(
      "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
      clientPayload(),
    )));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authorization" });
  });

  it("does not issue a second token while the same upload operation is in progress", async () => {
    intentMocks.authorizeManagedAssetUpload.mockResolvedValueOnce("in_progress");
    const response = await POST(request(payload(
      "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
      clientPayload(),
    )));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "uncertain_completion" });
  });

  it.each([
    ["missing token", null],
    ["malformed token payload", "not-json"],
  ])("rejects %s without exposing raw errors", async (_label, tokenPayload) => {
    const response = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          tokenPayload,
        ),
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication" });
  });

  it("rejects unexpected client payload fields", async () => {
    const response = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          JSON.stringify({
            assetId: "123e4567-e89b-12d3-a456-426614174000",
            contentType: "font/ttf",
            expectedSizeBytes: 9,
            idToken: "firebase-id-token",
            unexpected: true,
          }),
        ),
      ),
    );

    expect(response.status).toBe(401);
    expect(authMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it.each(["video/mp4", "", "application/x-custom"])(
    "rejects unsupported managed-asset MIME %s",
    async (contentType) => {
      const response = await POST(
        request(
          payload(
            "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
            clientPayload("firebase-id-token", contentType),
          ),
        ),
      );

      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "unsupported_type" });
      expect(authMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
    },
  );

  it("rejects a supported MIME that does not match the pathname extension", async () => {
    const response = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload("firebase-id-token", "application/json"),
        ),
      ),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "unsupported_type" });
    expect(authMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("rejects malformed and anonymous Firebase tokens", async () => {
    authMocks.verifyFirebaseIdToken.mockRejectedValueOnce(
      new FirebaseAuthenticationError("invalid token", new Error("raw token")),
    );
    const malformed = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload("malformed-token"),
        ),
      ),
    );
    expect(malformed.status).toBe(401);

    authMocks.verifyFirebaseIdToken.mockRejectedValueOnce(
      new FirebaseAuthenticationError("anonymous user"),
    );
    const anonymous = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload("anonymous-token"),
        ),
      ),
    );
    expect(anonymous.status).toBe(401);
  });

  it("rejects a path outside the authenticated user's namespace", async () => {
    const response = await POST(
      request(
        payload(
          "users/other/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload(),
        ),
      ),
    );

    expect(response.status).toBe(401);
    expect(authMocks.verifyFirebaseIdToken).toHaveBeenCalledWith(
      "firebase-id-token",
    );
  });

  it("returns an opaque unknown category for an unclassified service failure", async () => {
    blobMocks.handleUpload.mockRejectedValueOnce(new BlobUnknownError());
    const response = await POST(
      request(
        payload(
          "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf",
          clientPayload(),
        ),
      ),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "unknown" });
    expect(JSON.stringify(body)).not.toContain("quota");
  });

  it.each([
    "users/owner/assets/not-a-uuid",
    "users/owner/assets/123e4567-e89b-12d3-a456-426614174000.ttf/extra",
    "users/owner/other/123e4567-e89b-12d3-a456-426614174000.ttf",
  ])("rejects malformed asset pathname %s", async (pathname) => {
    const response = await POST(
      request(payload(pathname, clientPayload())),
    );

    expect(response.status).toBe(401);
  });
});
