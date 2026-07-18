import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase.server";

async function resolveOrigin(): Promise<string> {
  try {
    const { data } = await supabaseAdmin()
      .from("settings")
      .select("site_origin")
      .eq("id", 1)
      .single();
    if (data?.site_origin) return data.site_origin.replace(/\/$/, "");
  } catch {
    /* fall through to env */
  }
  return (process.env.SITE_ORIGIN ?? "").replace(/\/$/, "");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const BASE_URL = await resolveOrigin();
        const entries = [
          { path: "/", priority: "1.0", changefreq: "weekly" as const },
          { path: "/menu", priority: "0.9", changefreq: "weekly" as const },
          { path: "/quote", priority: "0.7", changefreq: "monthly" as const },
          { path: "/contact", priority: "0.6", changefreq: "monthly" as const },
        ];
        const urls = entries.map(
          (e) =>
            `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
