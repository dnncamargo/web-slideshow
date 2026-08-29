import "@powershow/theme/index.css";
import "./player.css";

import { startPlayer } from "./player-entry";
import { startWatch } from "./watch-entry";
import { startDemo } from "./demo-entry";
import { startCover } from "./cover-entry";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PowerShow Player root element was not found.");
}

if (window.location.pathname === "/demo") {
  startDemo(root);
} else if (window.location.pathname === "/watch") {
  startWatch(root);
} else if (window.location.pathname === "/cover") {
  startCover(root);
} else {
  startPlayer(root);
}
