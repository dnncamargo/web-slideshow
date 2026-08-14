"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { User } from "firebase/auth";

import {
  signInWithGoogle,
  signOutCurrentUser,
  subscribeToAuthState,
  type ObservableAuthState,
} from "./firebase-auth";

interface StudioAuthValue {
  status: ObservableAuthState["status"];
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const StudioAuthContext = createContext<StudioAuthValue | null>(null);

// ============================================================
// PROVIDER
//
// Observa o estado de autenticação do Firebase (loading /
// authenticated / unauthenticated) e expõe signInWithGoogle e
// signOut para a UI.
// ============================================================

export function StudioAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ObservableAuthState>({
    status: "loading",
    user: null,
  });

  useEffect(() => subscribeToAuthState(setState), []);

  const handleSignIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutCurrentUser();
  }, []);

  return (
    <StudioAuthContext.Provider
      value={{
        status: state.status,
        user: state.user,
        signInWithGoogle: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </StudioAuthContext.Provider>
  );
}

export function useStudioAuth(): StudioAuthValue {
  const value = useContext(StudioAuthContext);

  if (value === null) {
    throw new Error(
      "useStudioAuth must be used within a StudioAuthProvider.",
    );
  }

  return value;
}
