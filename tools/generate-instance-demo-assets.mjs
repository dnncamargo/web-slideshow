import { readInstanceDisplayName } from "./instance-config.mjs";
import { writeInstanceDemoAssets } from "./instance-demo-asset.mjs";

const displayName = readInstanceDisplayName();
writeInstanceDemoAssets(displayName);

console.log(`Generated instance demo assets for ${displayName}`);
