import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  read: vi.fn(),
  protect: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));
vi.mock("../src/features/persistence/managed-asset-controls", () => {
  class ManagedAssetControlError extends Error {
    constructor(readonly code: string) { super(code); }
  }
  return {
    readManagedAssetControl: mocks.read,
    setManagedAssetProtection: mocks.protect,
    renameManagedAsset: mocks.rename,
    deleteManagedAsset: mocks.remove,
    validateManagedAssetPath: (uid: string, path: unknown) => {
      if (typeof path !== "string" || !path.startsWith(`users/${uid}/assets/`)) {
        throw new ManagedAssetControlError("invalid_identity");
      }
      return path.slice(`users/${uid}/assets/`.length);
    },
    ManagedAssetControlError,
  };
});

import { DELETE } from "../src/app/api/managed-assets/delete/route";
import { GET, PUT } from "../src/app/api/managed-assets/protection/route";
import { PATCH } from "../src/app/api/managed-assets/rename/route";

const ownerPath = "users/owner-1/assets/legacy-object";
const auth = { authorization: "Bearer owner-token" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "owner-1" });
  mocks.read.mockResolvedValue({ protected: true, state: "active" });
  mocks.protect.mockImplementation(async (_uid: string, _path: string, protectedValue: boolean) => ({ protected: protectedValue, state: "active" }));
  mocks.remove.mockResolvedValue({ alreadyMissing: false });
  mocks.rename.mockImplementation(async (_uid: string, _path: string, displayName: string) => ({ displayName: displayName.trim(), protected: false, state: "active" }));
});

describe("managed asset protection and deletion routes", () => {
  it("requires Firebase authentication before reading or changing controls", async () => {
    const response = await GET(new Request(`http://localhost/api/managed-assets/protection?pathname=${encodeURIComponent(ownerPath)}`));
    expect(response.status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.protect).not.toHaveBeenCalled();
    const rename = await PATCH(new Request("http://localhost/api/managed-assets/rename", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathname: ownerPath, displayName: "Name" }) }));
    expect(rename.status).toBe(401);
    expect(mocks.rename).not.toHaveBeenCalled();

    const deletion = await DELETE(new Request("http://localhost/api/managed-assets/delete", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathname: ownerPath }),
    }));
    expect(deletion.status).toBe(401);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("isolates persisted controls and deletion to the authenticated owner's exact path", async () => {
    const getResponse = await GET(new Request(`http://localhost/api/managed-assets/protection?pathname=${encodeURIComponent(ownerPath)}`, { headers: auth }));
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({ protected: true, state: "active" });
    expect(mocks.read).toHaveBeenCalledWith("owner-1", ownerPath);

    const putResponse = await PUT(new Request("http://localhost/api/managed-assets/protection", {
      method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pathname: ownerPath, protected: false }),
    }));
    expect(putResponse.status).toBe(200);
    expect(mocks.protect).toHaveBeenCalledWith("owner-1", ownerPath, false);

    const deleteResponse = await DELETE(new Request("http://localhost/api/managed-assets/delete", {
      method: "DELETE", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pathname: ownerPath }),
    }));
    expect(deleteResponse.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith("owner-1", ownerPath);

    const wrongOwner = await PUT(new Request("http://localhost/api/managed-assets/protection", {
      method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pathname: "users/other/assets/legacy-object", protected: true }),
    }));
    expect(wrongOwner.status).toBe(400);
    expect(mocks.protect).toHaveBeenCalledTimes(1);
  });

  it("renames only the authenticated owner's exact physical path", async () => {
    const response = await PATCH(new Request("http://localhost/api/managed-assets/rename", {
      method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pathname: ownerPath, displayName: "  春の資料  " }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ displayName: "春の資料", protected: false, state: "active" });
    expect(mocks.rename).toHaveBeenCalledWith("owner-1", ownerPath, "  春の資料  ");

    const foreign = await PATCH(new Request("http://localhost/api/managed-assets/rename", {
      method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pathname: "users/other/assets/file", displayName: "Name" }),
    }));
    expect(foreign.status).toBe(400);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
