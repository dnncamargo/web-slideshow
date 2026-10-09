import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  onValue,
  ref,
  type Database,
} from "firebase/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectId = "demo-web-slideshow-player-offset";
let app: FirebaseApp;
let database: Database;

beforeAll(() => {
  app = initializeApp(
    {
      projectId,
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
    },
    "player-server-time-offset-emulator",
  );
  database = getDatabase(app);
  connectDatabaseEmulator(database, "127.0.0.1", 9000);
});

afterAll(async () => {
  await deleteApp(app);
});

describe("Player RTDB server time offset SDK behavior", () => {
  it("uses onValue for /.info/serverTimeOffset when get rejects the special path", async () => {
    const offsetRef = ref(database, ".info/serverTimeOffset");

    await expect(get(offsetRef)).rejects.toThrow("Invalid token in path");

    const offset = await new Promise<number>((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error("Timed out waiting for server time offset."));
      }, 5_000);

      unsubscribe = onValue(
        offsetRef,
        (snapshot) => {
          clearTimeout(timeout);
          const value = snapshot.val();
          unsubscribe?.();
          if (typeof value !== "number" || !Number.isFinite(value)) {
            reject(new Error("RTDB server time offset was not finite."));
            return;
          }
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          unsubscribe?.();
          reject(error);
        },
      );
    });

    expect(Number.isFinite(offset)).toBe(true);
  });
});
