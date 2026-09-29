import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";

const ASSET_PATH_PATTERN =
  /^users\/([^/]+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const MAX_CONTENT_TYPE_LENGTH = 256;

class ManagedAssetAuthorizationError extends Error {}

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
    throw new ManagedAssetAuthorizationError("Missing upload authorization.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new ManagedAssetAuthorizationError("Malformed upload authorization.");
  }

  if (!isRecord(parsed)) {
    throw new ManagedAssetAuthorizationError("Malformed upload authorization.");
  }

  const keys = Object.keys(parsed).sort();

  if (
    keys.length !== 2 ||
    keys[0] !== "contentType" ||
    keys[1] !== "idToken" ||
    typeof parsed.idToken !== "string" ||
    !parsed.idToken.trim() ||
    typeof parsed.contentType !== "string" ||
    parsed.contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    !/^[\x20-\x7e]*$/.test(parsed.contentType)
  ) {
    throw new ManagedAssetAuthorizationError("Malformed upload authorization.");
  }

  return {
    idToken: parsed.idToken,
    contentType: parsed.contentType,
  };
}

function assertAuthorizedAssetPath(pathname: string, uid: string): void {
  const match = ASSET_PATH_PATTERN.exec(pathname);

  if (!match || match[1] !== uid) {
    throw new ManagedAssetAuthorizationError("Unauthorized asset path.");
  }
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid upload request.");
  }

  if (!isRecord(body) || typeof body.type !== "string") {
    return errorResponse(400, "Invalid upload request.");
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
    if (
      error instanceof ManagedAssetAuthorizationError ||
      error instanceof FirebaseAuthenticationError
    ) {
      return errorResponse(401, "Unauthorized upload request.");
    }

    return errorResponse(500, "Managed asset upload is unavailable.");
  }
}
