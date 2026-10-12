import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import {
  classifyManagedAssetExtension,
  isManagedAssetContentType,
} from "../../../../features/persistence/managed-asset-content-types";
import {
  authorizeManagedAssetUpload,
  reconcileManagedAssetIntent,
} from "../../../../features/persistence/managed-asset-intents";
import {
  classifyManagedAssetUploadError,
  FirebaseAuthenticationError,
  FirebaseConfigurationError,
  type ManagedAssetUploadErrorCategory,
} from "../../../../features/persistence/persistence-errors";

const ASSET_PATH_PATTERN =
  /^users\/([^/]+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\.[a-z0-9]+)$/i;
const MAX_CONTENT_TYPE_LENGTH = 256;

class ManagedAssetRequestError extends Error {
  constructor(
    message: string,
    readonly category: ManagedAssetUploadErrorCategory,
  ) {
    super(message);
    this.name = "ManagedAssetRequestError";
  }
}

interface ManagedAssetClientPayload {
  idToken: string;
  contentType: string;
  assetId: string;
  expectedSizeBytes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClientPayload(
  clientPayload: string | null,
): ManagedAssetClientPayload {
  if (clientPayload === null) {
    throw new ManagedAssetRequestError("Missing upload authorization.", "authentication");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new ManagedAssetRequestError("Malformed upload authorization.", "authentication");
  }

  if (!isRecord(parsed)) {
    throw new ManagedAssetRequestError("Malformed upload authorization.", "authentication");
  }

  const keys = Object.keys(parsed).sort();

  if (
    keys.length !== 4 ||
    keys[0] !== "assetId" ||
    keys[1] !== "contentType" ||
    keys[2] !== "expectedSizeBytes" ||
    keys[3] !== "idToken" ||
    typeof parsed.assetId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.assetId) ||
    typeof parsed.expectedSizeBytes !== "number" ||
    !Number.isSafeInteger(parsed.expectedSizeBytes) ||
    parsed.expectedSizeBytes < 0 ||
    typeof parsed.idToken !== "string" ||
    !parsed.idToken.trim() ||
    typeof parsed.contentType !== "string" ||
    !isManagedAssetContentType(parsed.contentType) ||
    parsed.contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    !/^[\x20-\x7e]*$/.test(parsed.contentType)
  ) {
    throw new ManagedAssetRequestError(
      "Unsupported upload content type.",
      typeof parsed.contentType === "string" && !isManagedAssetContentType(parsed.contentType)
        ? "unsupported_type"
        : "authentication",
    );
  }

  return {
    idToken: parsed.idToken,
    contentType: parsed.contentType,
    assetId: parsed.assetId,
    expectedSizeBytes: parsed.expectedSizeBytes,
  };
}

function assertAuthorizedAssetPath(pathname: string, uid: string): void {
  const match = ASSET_PATH_PATTERN.exec(pathname);

  if (!match || match[1] !== uid) {
    throw new ManagedAssetRequestError("Unauthorized asset path.", "authorization");
  }

  const classification = classifyManagedAssetExtension(match[3] ?? "");
  if (classification === null) {
    throw new ManagedAssetRequestError("Unsupported asset extension.", "unsupported_type");
  }
}

function assertContentTypeMatchesPath(pathname: string, contentType: string): void {
  const match = ASSET_PATH_PATTERN.exec(pathname);
  if (match === null) {
    throw new ManagedAssetRequestError("Unauthorized asset path.", "authorization");
  }
  const classification = classifyManagedAssetExtension(match[3] ?? "");

  if (classification === null || classification.contentType !== contentType) {
    throw new ManagedAssetRequestError(
      "Upload content type does not match its extension.",
      "unsupported_type",
    );
  }
}

function errorResponse(status: number, category: ManagedAssetUploadErrorCategory): NextResponse {
  return NextResponse.json({ error: category }, { status });
}

function statusForCategory(category: ManagedAssetUploadErrorCategory): number {
  switch (category) {
    case "authentication":
    case "authorization": return 401;
    case "unsupported_type": return 415;
    case "file_too_large": return 413;
    case "rate_limited": return 429;
    case "service_unavailable":
    case "store_suspended": return 503;
    default: return 500;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "unknown");
  }

  if (!isRecord(body) || typeof body.type !== "string") {
    return errorResponse(400, "unknown");
  }

  try {
    const response = await handleUpload({
      body: body as unknown as HandleUploadBody,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        assertContentTypeMatchesPath(pathname, payload.contentType);
        const user = await verifyFirebaseIdToken(payload.idToken);

        assertAuthorizedAssetPath(pathname, user.uid);
        const match = ASSET_PATH_PATTERN.exec(pathname);
        if (!match || match[2] !== payload.assetId) {
          throw new ManagedAssetRequestError("Upload identity does not match its intent.", "authorization");
        }
        let authorization: "authorized" | "complete" | "in_progress";
        try {
          authorization = await authorizeManagedAssetUpload(
            user.uid,
            payload.assetId,
            pathname,
            payload.contentType,
            payload.expectedSizeBytes,
          );
        } catch (error) {
          if (error instanceof Error && error.message === "intent_mismatch") {
            throw new ManagedAssetRequestError("Upload intent does not match the requested object.", "authorization");
          }
          if (error instanceof Error && (error.message === "intent_conflict" || error.message === "physical_uncertain")) {
            throw new ManagedAssetRequestError("Upload intent requires recovery before another transfer.", "uncertain_completion");
          }
          throw error;
        }
        if (authorization !== "authorized") {
          throw new ManagedAssetRequestError(
            authorization === "complete" ? "Upload already completed." : "Upload is still in progress.",
            "uncertain_completion",
          );
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          allowedContentTypes: [payload.contentType],
          maximumSizeInBytes: payload.expectedSizeBytes,
          tokenPayload: JSON.stringify({ uid: user.uid, assetId: payload.assetId }),
        };
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        if (!tokenPayload) throw new Error("Missing managed asset completion identity.");
        const completion: unknown = JSON.parse(tokenPayload);
        if (!isRecord(completion) || typeof completion.uid !== "string" || typeof completion.assetId !== "string") {
          throw new Error("Malformed managed asset completion identity.");
        }
        const recovered = await reconcileManagedAssetIntent(completion.uid, completion.assetId);
        if (recovered.status !== "complete") throw new Error("Physical managed asset could not be verified.");
      },
      request,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ManagedAssetRequestError) {
      const status = error.category === "unsupported_type"
        ? 415
        : error.category === "uncertain_completion" ? 409 : 401;
      return errorResponse(status, error.category);
    }

    if (error instanceof FirebaseAuthenticationError) {
      return errorResponse(401, "authentication");
    }

    if (error instanceof FirebaseConfigurationError) {
      return errorResponse(503, "service_unavailable");
    }

    const category = classifyManagedAssetUploadError(error);
    return errorResponse(statusForCategory(category), category);
  }
}
