import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin, supabaseAuthClient } from "./supabase.server";

const ACCESS_COOKIE = "boys-admin-access";
const REFRESH_COOKIE = "boys-admin-refresh";

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export interface AdminSession {
  userId: string;
  email: string;
}

function storeSession(s: { access_token: string; refresh_token: string; expires_in: number }) {
  setCookie(ACCESS_COOKIE, s.access_token, {
    ...cookieOpts(),
    maxAge: s.expires_in,
  });
  setCookie(REFRESH_COOKIE, s.refresh_token, {
    ...cookieOpts(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const { data, error } = await supabaseAuthClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session || !data.user) throw new Error("Invalid email or password");
  storeSession(data.session);
  return { userId: data.user.id, email: data.user.email ?? "" };
}

/** Returns the session or null. Refreshes transparently when the access token expired. */
export async function getAdminSessionOrNull(): Promise<AdminSession | null> {
  const access = getCookie(ACCESS_COOKIE);
  if (access) {
    const { data } = await supabaseAdmin().auth.getUser(access);
    if (data.user) return { userId: data.user.id, email: data.user.email ?? "" };
  }
  const refresh = getCookie(REFRESH_COOKIE);
  if (refresh) {
    const { data, error } = await supabaseAuthClient().auth.refreshSession({
      refresh_token: refresh,
    });
    if (!error && data.session && data.user) {
      storeSession(data.session);
      return { userId: data.user.id, email: data.user.email ?? "" };
    }
  }
  return null;
}

/** Gate for every admin server fn. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSessionOrNull();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function signOutAdmin(): void {
  deleteCookie(ACCESS_COOKIE, { path: "/" });
  deleteCookie(REFRESH_COOKIE, { path: "/" });
}
