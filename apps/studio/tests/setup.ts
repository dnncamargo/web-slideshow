import { vi } from "vitest";

vi.mock("../src/features/auth/firebase-auth", async () => {
  const actual = await vi.importActual<typeof import("../src/features/auth/firebase-auth")>(
    "../src/features/auth/firebase-auth",
  );

  return {
    ...actual,
    getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "owner-a", isAnonymous: false })),
  };
});
