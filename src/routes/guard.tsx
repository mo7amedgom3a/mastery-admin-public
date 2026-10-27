import { useEffect, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAdminAuth } from "@/lib/auth/store";
import { canSeeModule, canSeeNavItem, canWithScopes } from "@/lib/permissions";
import { flatItems, navigation } from "@/config/navigation";
import { Empty } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

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

/**
 * Send each admin to the first page their scopes actually cover. Used by the `/`
 * index route so a marketer or team lead never lands on the sales dashboard.
 */
export function LandingRedirect() {
  const admin = useAdminAuth((state) => state.admin);
  const modules = navigation
    .filter((module) => canSeeModule(module, admin?.scopes))
    .map((module) => ({
      ...module,
      sections: module.sections
        .map((section) => ({
          ...section,
          items: section.items
            .filter((item) => canSeeNavItem(item, admin?.scopes))
            .map((item) =>
              item.children
                ? {
                    ...item,
                    children: item.children.filter((child) => canSeeNavItem(child, admin?.scopes)),
                  }
                : item,
            ),
        }))
        .filter((section) => section.items.length),
    }))
    .filter((module) => module.sections.length);
  const first = flatItems(modules)[0];
  return <Navigate to={first?.href ?? "/access/users"} replace />;
}

/**
 * Page-level scope gate. The API is the real authorization boundary; this only stops an admin
 * from opening a page their scopes do not cover (e.g. a marketer typing `/access/policies`).
 */
export function RequireScope({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const t = useT();
  const admin = useAdminAuth((state) => state.admin);

  if (!canWithScopes(admin?.scopes, permission)) {
    return (
      <Empty
        icon="shield"
        text={t(
          "لا تملك صلاحية فتح هذه الصفحة.",
          "You do not have permission to open this page.",
        )}
      />
    );
  }

  return <>{children}</>;
}
