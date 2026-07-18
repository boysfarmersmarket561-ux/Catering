import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";

export interface SiteSettings {
  notification_email: string;
  store_hours: string[];
  facebook_url: string | null;
  instagram_url: string | null;
  site_origin: string | null;
}

export const getSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const { data, error } = await supabaseAdmin().from("settings").select("*").eq("id", 1).single();
    if (error) throw new Error(`getSettings: ${error.message}`);
    return {
      notification_email: data.notification_email,
      store_hours: (data.store_hours ?? []) as string[],
      facebook_url: data.facebook_url,
      instagram_url: data.instagram_url,
      site_origin: data.site_origin,
    };
  },
);

export const updateSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      notification_email: z
        .string()
        .trim()
        .email()
        .max(320)
        .transform((s) => s.toLowerCase()),
      store_hours: z.array(z.string().trim().min(1).max(200)).max(14),
      facebook_url: z.string().trim().url().max(500).nullable(),
      instagram_url: z.string().trim().url().max(500).nullable(),
      site_origin: z.string().trim().url().max(200).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("settings").update(data).eq("id", 1);
    if (error) throw new Error(`updateSettings: ${error.message}`);
    return { ok: true };
  });
