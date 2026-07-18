import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  signInAdmin,
  signOutAdmin,
  getAdminSessionOrNull,
  type AdminSession,
} from "@/lib/admin-auth.server";

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().trim().email(), password: z.string().min(1) }))
  .handler(async ({ data }): Promise<AdminSession> => signInAdmin(data.email, data.password));

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  signOutAdmin();
  return { ok: true };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSession | null> => getAdminSessionOrNull(),
);
