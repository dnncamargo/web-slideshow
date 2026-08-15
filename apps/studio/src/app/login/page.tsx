"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";

import { useStudioAuth } from "@/features/auth/studio-auth-provider";

import styles from "./login.module.css";

// ============================================================
// LOGIN PAGE
//
// Google Sign-In apenas.
// ============================================================

export default function LoginPage() {
  const { t } = useStudioI18n();
  const router = useRouter();
  const { status, signInWithGoogle } = useStudioAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(STUDIO_ROUTES.library);
    }
  }, [status, router]);

  async function handleSignIn() {
    if (signingIn) {
      return;
    }

    setSigningIn(true);
    setError(null);

    try {
      await signInWithGoogle();
      // O observer/auth status irá redirecionar para a Library.
    } catch (cause) {
      console.error("Login: Google sign-in failed", cause);
      setError(t("auth.signInFailed"));
    } finally {
      setSigningIn(false);
    }
  }

  if (status === "loading") {
    return (
      <main className={styles.page}>
        <span>{t("auth.loading")}</span>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow</h1>

        <button
          type="button"
          className={styles.button}
          disabled={signingIn || status === "authenticated"}
          onClick={() => void handleSignIn()}
        >
          {signingIn ? t("auth.signingIn") : t("auth.continueWithGoogle")}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
