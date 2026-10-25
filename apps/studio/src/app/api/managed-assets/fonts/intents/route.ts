import { handleCreateManagedAssetIntent } from "../../intent-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleCreateManagedAssetIntent(request, "fonts");
}
