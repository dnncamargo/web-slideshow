import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { isManagedAssetContentType } from "../../../../features/persistence/managed-asset-content-types";
import {
  classifyManagedAssetUploadError,
  FirebaseAuthenticationError,
  FirebaseConfigurationError,
  type ManagedAssetUploadErrorCategory,
} from "../../../../features/persistence/persistence-errors";

const ASSET_PATH_PATTERN =
  /^users\/([^/]+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
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
    keys.length !== 2 ||
    keys[0] !== "contentType" ||
    keys[1] !== "idToken" ||
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
  };
}

function assertAuthorizedAssetPath(pathname: string, uid: string): void {
  const match = ASSET_PATH_PATTERN.exec(pathname);

  if (!match || match[1] !== uid) {
    throw new ManagedAssetRequestError("Unauthorized asset path.", "authorization");
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
        const user = await verifyFirebaseIdToken(payload.idToken);

        assertAuthorizedAssetPath(pathname, user.uid);

        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          allowedContentTypes: [payload.contentType],
        };
      },
      onUploadCompleted: async () => {
        // Upload completion is intentionally side-effect free. The client
        // receives the finalized public URL directly from upload().
      },
      request,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ManagedAssetRequestError) {
      return errorResponse(error.category === "unsupported_type" ? 415 : 401, error.category);
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
