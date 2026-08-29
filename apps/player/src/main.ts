import "@powershow/theme/index.css";
import "./player.css";

import { startPlayer } from "./player-entry";
import { startWatch } from "./watch-entry";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PowerShow Player root element was not found.");
}

if (window.location.pathname === "/watch") {
  startWatch(root);
} else {
  startPlayer(root);
}
