import { WatchPage } from "@/features/watch/watch-page";

// ============================================================
// PUBLIC WATCH ROUTE
//
// /watch is public: it is intentionally NOT wrapped in the Studio
// authorization gate. The root auth provider may remain because it is not an
// authorization gate.
// ============================================================

export default function WatchRoute() {
  return <WatchPage />;
}
