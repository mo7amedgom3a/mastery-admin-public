import { create } from "zustand";

import { ApiError, setUnauthorizedHandler } from "@/lib/api/client";
import {
  adminLogin,
  adminQALogin,
  adminLogout,
  adminMe,
  adminRefresh,
  type AdminLoginRequest,
  type AdminProfile,
} from "@/lib/api";

export type AdminStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export type AdminAuthState = {
  status: AdminStatus;
  admin: AdminProfile | null;
  bootstrap: () => Promise<AdminProfile | null>;
  login: (credentials: AdminLoginRequest) => Promise<AdminProfile>;
  qaLogin: (credentials: { email: string; key: string }) => Promise<AdminProfile>;
  logout: () => Promise<void>;
  refresh: (refresh_token?: string) => Promise<AdminProfile | null>;
  setAuthenticated: (admin: AdminProfile) => void;
  setUnauthenticated: () => void;
};

type AdminMessage = "signed-in" | "signed-out";

/** Tells this browser's other tabs when one of them signs in or out. */
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("mastery-admin-auth")
    : null;

function announce(message: AdminMessage): void {
  channel?.postMessage(message);
}

let bootstrapping: Promise<AdminProfile | null> | null = null;
let refreshing: Promise<AdminProfile | null> | null = null;

/**
 * Who is signed in, for the UI. It holds the admin's profile and scopes only: the tokens live in
 * httpOnly cookies the backend sets (`b2c_admin_access_token` / `b2c_admin_refresh_token`) on this
 * same origin, and nothing in the app ever reads them.
 */
export const useAdminAuth = create<AdminAuthState>((set, get) => ({
  status: "idle",
  admin: null,

  bootstrap: () => {
    bootstrapping ??= (async () => {
      if (get().status !== "authenticated") set({ status: "loading" });
      try {
        const admin = await adminMe();
        get().setAuthenticated(admin);
        return admin;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const refreshed = await get().refresh();
          if (refreshed) return refreshed;
        }
        get().setUnauthenticated();
        return null;
      } finally {
        bootstrapping = null;
      }
    })();
    return bootstrapping;
  },

  refresh: (refresh_token) => {
    refreshing ??= (async () => {
      try {
        const session = await adminRefresh({ refresh_token });
        get().setAuthenticated(session.admin);
        return session.admin;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          get().setUnauthenticated();
          announce("signed-out");
          return null;
        }
        throw error;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  },

  login: async (credentials) => {
    const session = await adminLogin(credentials);
    get().setAuthenticated(session.admin);
    announce("signed-in");
    return session.admin;
  },

  qaLogin: async (credentials) => {
    const session = await adminQALogin(credentials);
    get().setAuthenticated(session.admin);
    announce("signed-in");
    return session.admin;
  },

  logout: async () => {
    try {
      await adminLogout();
    } finally {
      get().setUnauthenticated();
      announce("signed-out");
    }
  },

  setAuthenticated: (admin) => set({ status: "authenticated", admin }),
  setUnauthenticated: () => set({ status: "unauthenticated", admin: null }),
}));

// Until middleware-like route guards, keep a tab in sync with sign-out from another tab.
channel?.addEventListener("message", (event: MessageEvent<AdminMessage>) => {
  if (event.data === "signed-out") useAdminAuth.getState().setUnauthenticated();
  else if (event.data === "signed-in") useAdminAuth.getState().bootstrap().catch(() => undefined);
});

// A data request that 401s mid-session (expired access token) refreshes once and retries, so the
// dashboard keeps showing data instead of silently falling back to zeros.
setUnauthorizedHandler(async () => {
  try {
    const admin = await useAdminAuth.getState().refresh();
    return Boolean(admin);
  } catch {
    return false;
  }
});

/** Scope helper for the UI: `*` (super admin) grants everything, codes match exactly. */
export function hasScope(scopes: string[] | undefined, needed: string): boolean {
  return Boolean(scopes?.includes("*") || scopes?.includes(needed));
}
