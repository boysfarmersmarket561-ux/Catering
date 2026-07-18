import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  disabled: boolean;
}

/** Supabase marks a user banned via banned_until; treat any future date as disabled. */
function isDisabled(u: { banned_until?: string | null }): boolean {
  return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
}

export const listStaff = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffUser[]> => {
    await requireAdmin();
    const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(`listStaff: ${error.message}`);
    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      // user_metadata is user-editable — display only, NEVER used for authorization.
      name: (u.user_metadata?.full_name as string | undefined) ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      disabled: isDisabled(u as { banned_until?: string | null }),
    }));
  },
);

export const createStaff = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .max(320)
        .transform((s) => s.toLowerCase()),
      name: z.string().trim().min(1).max(120),
      password: z.string().min(12).max(200),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // staff are trusted; skip the confirmation round-trip
      user_metadata: { full_name: data.name },
    });
    if (error) throw new Error(`createStaff: ${error.message}`);
    return { ok: true };
  });

export const renameStaff = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().auth.admin.updateUserById(data.id, {
      user_metadata: { full_name: data.name },
    });
    if (error) throw new Error(`renameStaff: ${error.message}`);
    return { ok: true };
  });

async function activeAdminCount(): Promise<number> {
  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`activeAdminCount: ${error.message}`);
  return data.users.filter((u) => !isDisabled(u as { banned_until?: string | null })).length;
}

export const setStaffDisabled = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), disabled: z.boolean() }))
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    if (data.id === session.userId) throw new Error("You cannot disable your own account.");
    if (data.disabled && (await activeAdminCount()) <= 1) {
      throw new Error("Cannot disable the last active staff account.");
    }
    const { error } = await supabaseAdmin().auth.admin.updateUserById(data.id, {
      ban_duration: data.disabled ? "876000h" : "none", // ~100 years = indefinite
    });
    if (error) throw new Error(`setStaffDisabled: ${error.message}`);
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    if (data.id === session.userId) throw new Error("You cannot delete your own account.");
    if ((await activeAdminCount()) <= 1)
      throw new Error("Cannot delete the last active staff account.");
    const { error } = await supabaseAdmin().auth.admin.deleteUser(data.id);
    if (error) throw new Error(`deleteStaff: ${error.message}`);
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), password: z.string().min(12).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(`resetStaffPassword: ${error.message}`);
    return { ok: true };
  });
