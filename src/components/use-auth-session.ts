"use client";

import { useEffect, useState } from "react";

type SessionUser = { email: string };
type SessionResponse = { email?: string; user?: SessionUser; data?: { email?: string; user?: SessionUser } };

// TODO(auth-session): Remove this fallback after the BE publishes GET /api/auth/session.
const localSession: SessionUser = { email: "admin@olym.local" };

export function useAuthSession() {
  const [user, setUser] = useState<SessionUser>(localSession);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session endpoint is unavailable");
        return response.json() as Promise<SessionResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        const email = body.email ?? body.user?.email ?? body.data?.email ?? body.data?.user?.email;
        if (email) setUser({ email });
      })
      .catch(() => {
        // The local fallback keeps the chrome useful while the session endpoint lands.
      });
    return () => { cancelled = true; };
  }, []);

  return user;
}
