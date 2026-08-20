import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  serverTimestamp: vi.fn(),
  runTransaction: vi.fn(),
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

import type {
  Presentation,
  PowerShowElement,
  Slide,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";

import {
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  runTransaction,
  doc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedSetDoc = vi.mocked(setDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedIncrement = vi.mocked(increment);
const mockedServerTimestamp = vi.mocked(serverTimestamp);
const mockedRunTransaction = vi.mocked(runTransaction);
const mockedDoc = vi.mocked(doc);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationRepository();

function text(id: string, content = id): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body" as const,
    content,
  };
}

function topicItem(
  id: string,
  children: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: {
      id: `${id}-slot`,
      children: [text(`${id}-text`)],
    },
    children,
  };
}

function topicsElement(): TopicsElement {
  return {
    type: "topics",
    id: "topics-root",
    hidden: false,
    kind: "unordered",
    items: [
      topicItem("topic-parent", [
        topicItem("topic-child", [
          topicItem("topic-grandchild"),
        ]),
      ]),
    ],
  };
}

function nestedAutonomousTopicsElement(): TopicsElement {
  return {
    type: "topics",
    id: "nested-topics-root",
    hidden: false,
    kind: "ordered",
    items: [
      topicItem("nested-topics-item"),
    ],
  };
}

function nestedContainerElement(depth: number): PowerShowElement {
  if (depth <= 0) {
    return text("leaf-text");
  }

  return {
    type: "container",
    id: `container-${depth}`,
    hidden: false,
    direction: "column" as const,
    children: [nestedContainerElement(depth - 1)],
  };
}

function nestedContainerPresentation(depth: number): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-nested-containers",
    title: "Nested containers",
    description: "",
    aspectRatio: "16:9",
    slides: [
      {
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [nestedContainerElement(depth)],
      },
    ],
  });
}

describe("draft revision persistence wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
    mockedServerTimestamp.mockReturnValue("server-ts" as never);
    mockedIncrement.mockImplementation(((n: number) => ({ __increment: n })) as never);
    mockedRunTransaction.mockImplementation(async (_firestore, callback) => {
      const transaction = {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      };

      return callback(transaction as never);
    });
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

  it("preserves recursive TopicsElement content when saving a draft", async () => {
    const presentation = createBlankPresentation("pres-topics");
    const slide: Slide = {
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [topicsElement()],
    };

    presentation.slides = [slide];

    await repository.savePresentation(presentation);

    type SavedTopicItem = {
      content?: {
        children?: Array<{ content?: string }>;
      };
      children?: SavedTopicItem[];
    };

    type SavedTopicsElement = {
      items?: SavedTopicItem[];
    };

    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as {
      presentation?: {
        slides?: Array<{
          elements?: Array<SavedTopicsElement>;
        }>;
      };
    };

    const savedTopics = payload?.presentation?.slides?.[0]?.elements?.[0];
    const parent = savedTopics?.items?.[0];
    const child = parent?.children?.[0];
    const grandchild = child?.children?.[0];

    expect(parent?.children).toHaveLength(1);
    expect(child?.children).toHaveLength(1);
    expect(grandchild?.content?.children?.[0]?.content).toBe("topic-grandchild-text");
  });

  it("preserves an autonomous nested TopicsElement inside a topic content slot", async () => {
    const presentation = createBlankPresentation("pres-nested-topics");
    const slide: Slide = {
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          type: "topics",
          id: "topics-root",
          hidden: false,
          kind: "unordered",
          items: [
            {
              id: "topic-parent",
              content: {
                id: "slot-parent",
                children: [nestedAutonomousTopicsElement()],
              },
              children: [],
            },
          ],
        },
      ],
    };

    presentation.slides = [slide];

    await repository.savePresentation(presentation);

    type SavedTopicItem = {
      content?: {
        children?: Array<{
          items?: SavedTopicItem[];
        }>;
      };
      children?: SavedTopicItem[];
    };

    type SavedTopicsElement = {
      items?: SavedTopicItem[];
    };

    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as {
      presentation?: {
        slides?: Array<{
          elements?: Array<SavedTopicsElement>;
        }>;
      };
    };

    const nestedTopics = payload?.presentation?.slides?.[0]?.elements?.[0]
      ?.items?.[0]?.content?.children?.[0];

    expect(nestedTopics?.items?.[0]?.children).toHaveLength(0);
  });

  it("rejects over-depth nested containers before updateDoc is called", async () => {
    const presentation = nestedContainerPresentation(9);

    await expect(repository.savePresentation(presentation)).rejects.toThrow(
      /too deeply nested/i,
    );
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it("rejects over-depth nested containers before setDoc is called", async () => {
    const presentation = nestedContainerPresentation(9);

    await expect(repository.createPresentation(presentation)).rejects.toThrow(
      /too deeply nested/i,
    );
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("saves valid nested containers normally", async () => {
    const presentation = nestedContainerPresentation(3);

    await expect(repository.savePresentation(presentation)).resolves.toBeUndefined();
    expect(mockedUpdateDoc).toHaveBeenCalled();
  });

  it("does not write a published version for over-depth nested containers", async () => {
    const presentation = nestedContainerPresentation(9);
    const transaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          presentation,
          draftRevision: 1,
        }),
      }),
      set: vi.fn(),
      update: vi.fn(),
    };

    mockedRunTransaction.mockImplementation(async (_firestore, callback) =>
      callback(transaction as never),
    );

    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      /too deeply nested/i,
    );
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
