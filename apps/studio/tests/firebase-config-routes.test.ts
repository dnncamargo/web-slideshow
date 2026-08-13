import { describe, expect, it } from "vitest";

import { resolveFirebaseClientConfig } from "../src/features/persistence/firebase-config";
import { FirebaseConfigurationError } from "../src/features/persistence/persistence-errors";
import { STUDIO_ROUTES } from "../src/features/app/studio-routes";

const VARS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
};

function setEnv(values: Partial<Record<keyof typeof VARS, string>>): void {
  for (const key of Object.keys(VARS) as Array<keyof typeof VARS>) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

describe("studio routing structure", () => {
  it("places the library under /studio/library and editor under /studio/editor", () => {
    expect(STUDIO_ROUTES.library).toBe("/studio/library");
    expect(STUDIO_ROUTES.editor).toBe("/studio/editor");
    expect(STUDIO_ROUTES.studio).toBe("/studio");
    expect(STUDIO_ROUTES.root).toBe("/");
  });
});

describe("firebase client config resolution", () => {
  it("throws a deterministic configuration error when env is missing", () => {
    setEnv({});

    expect(() => resolveFirebaseClientConfig()).toThrow(
      FirebaseConfigurationError,
    );
  });

  it("resolves config only when all variables are present", () => {
    setEnv({
      NEXT_PUBLIC_FIREBASE_API_KEY: "key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "domain",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "project",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "bucket",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "sender",
      NEXT_PUBLIC_FIREBASE_APP_ID: "app",
    });

    const config = resolveFirebaseClientConfig();

    expect(config).toEqual({
      apiKey: "key",
      authDomain: "domain",
      projectId: "project",
      storageBucket: "bucket",
      messagingSenderId: "sender",
      appId: "app",
    });
  });
});
