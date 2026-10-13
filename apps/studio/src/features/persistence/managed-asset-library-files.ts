import type { CustomLibraryFileRecord } from "../custom-library/custom-library-file";
import {
  getEffectiveManagedAssetStoreId,
  isValidManagedAssetInventoryCursor,
  listManagedAssetInventoryPage,
} from "./managed-asset-inventory";
import { listManagedAssetIntentRecords } from "./managed-asset-intents";
import { projectManagedAssetLibraryFiles } from "./managed-asset-library-file-projection";

export interface ManagedAssetLibraryFilePage {
  scope: "owner";
  records: CustomLibraryFileRecord[];
  hasMore: boolean;
  cursor?: string;
}

export async function listManagedAssetLibraryFilePage(
  uid: string,
  cursor: string | null,
): Promise<ManagedAssetLibraryFilePage> {
  if (!isValidManagedAssetInventoryCursor(cursor)) throw new Error("Managed asset library request is invalid.");
  const storeId = getEffectiveManagedAssetStoreId();
  const [inventory, intents] = await Promise.all([
    listManagedAssetInventoryPage(uid, cursor),
    listManagedAssetIntentRecords(uid),
  ]);
  const records = projectManagedAssetLibraryFiles(uid, storeId, inventory.items, intents);
  return {
    scope: "owner",
    records,
    hasMore: inventory.hasMore,
    ...(inventory.cursor === undefined ? {} : { cursor: inventory.cursor }),
  };
}
