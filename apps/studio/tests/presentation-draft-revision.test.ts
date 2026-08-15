import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  serverTimestamp: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";

import {
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  doc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedSetDoc = vi.mocked(setDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedIncrement = vi.mocked(increment);
const mockedServerTimestamp = vi.mocked(serverTimestamp);
const mockedDoc = vi.mocked(doc);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationRepository();

describe("draft revision persistence wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
    mockedServerTimestamp.mockReturnValue("server-ts" as never);
    mockedIncrement.mockImplementation(((n: number) => ({ __increment: n })) as never);
  });

  it("creates a document with draftRevision 1", async () => {
    const presentation = createBlankPresentation("pres-1");

    await repository.createPresentation(presentation);

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-1",
    );
    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload).toMatchObject({ draftRevision: 1 });
    expect(payload).not.toHaveProperty("publication");
    expect(payload).not.toHaveProperty("draftRevisionGreaterThanOne");
  });

  it("saves using atomic increment for draftRevision", async () => {
    const presentation = createBlankPresentation("pres-1");

    await repository.savePresentation(presentation);

    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(mockedIncrement).toHaveBeenCalledWith(1);
    expect(payload?.draftRevision).toEqual({ __increment: 1 });
    expect(payload).not.toHaveProperty("publication");
    expect(payload).not.toHaveProperty("createdAt");
  });

  it("rejects write when no authenticated non-anonymous user exists", async () => {
    const presentation = createBlankPresentation("pres-1");

    mockedGetCurrentUser.mockReturnValue(null as never);

    await expect(repository.createPresentation(presentation)).rejects.toThrow(
      /Unauthenticated/,
    );
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("rejects write when the current user is anonymous", async () => {
    const presentation = createBlankPresentation("pres-1");

    mockedGetCurrentUser.mockReturnValue({ uid: "anon", isAnonymous: true } as never);

    await expect(repository.savePresentation(presentation)).rejects.toThrow(
      /anonymous/,
    );
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });
});