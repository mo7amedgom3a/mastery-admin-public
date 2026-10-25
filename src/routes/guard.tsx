import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAdminAuth } from "@/lib/auth/store";

/**
 * Session gate on first mount: unauthenticated visitors go to /login, everyone else renders the
 * matched page. Per-request 401s from data queries sign the admin out through the store.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, bootstrap } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    bootstrap()
      .then((admin) => {
        if (!admin) navigate("/login", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [bootstrap, navigate]);

  if (status !== "authenticated") {
    return <div className="ma-splash">Checking your session…</div>;
  }

  return <>{children}</>;
}
