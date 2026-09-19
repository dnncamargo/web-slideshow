import "@web-slideshow/theme/index.css";
import { displayName } from "@web-slideshow/instance-branding";
import "./player.css";

import { startPlayer } from "./player-entry";
import { startWatch } from "./watch-entry";
import { startDemo } from "./demo-entry";
import { startCover } from "./cover-entry";

const root = document.querySelector<HTMLElement>("#app");

document.title = `${displayName} Player`;

if (!root) {
  throw new Error("Player root element was not found.");
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
