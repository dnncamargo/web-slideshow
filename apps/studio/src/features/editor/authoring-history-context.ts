import { createContext, useContext } from "react";

import type { HistoryActionMeta } from "./editor-history-state";

export interface AuthoringHistoryContextValue {
  begin(key: string, meta: HistoryActionMeta): void;
  update(key: string, callback: () => void): void;
  finish(key?: string): void;
  discrete(meta: HistoryActionMeta, callback: () => void): void;
}

export const AuthoringHistoryContext = createContext<AuthoringHistoryContextValue | null>(null);

export function useAuthoringHistory(): AuthoringHistoryContextValue | null {
  return useContext(AuthoringHistoryContext);
}
