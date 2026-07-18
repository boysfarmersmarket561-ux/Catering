import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsQueryOptions } from "@/lib/queries";
import { updateSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function SettingsForm() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions());
  const queryClient = useQueryClient();

  const [notificationEmail, setNotificationEmail] = useState(settings.notification_email);
  const [storeHours, setStoreHours] = useState(settings.store_hours.join("\n"));
  const [facebookUrl, setFacebookUrl] = useState(settings.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(settings.instagram_url ?? "");
  const [siteOrigin, setSiteOrigin] = useState(settings.site_origin ?? "");

  const save = useMutation({
    mutationFn: (data: Parameters<typeof updateSettings>[0]["data"]) => updateSettings({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const urlFields: Array<[string, string]> = [
      ["Facebook URL", facebookUrl],
      ["Instagram URL", instagramUrl],
      ["Site origin", siteOrigin],
    ];
    for (const [label, value] of urlFields) {
      if (value.trim() && !isValidUrl(value.trim())) {
        toast.error(`${label} is not a valid URL.`);
        return;
      }
    }

    const hours = storeHours
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    save.mutate({
      notification_email: notificationEmail.trim(),
      store_hours: hours,
      facebook_url: facebookUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      site_origin: siteOrigin.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6 py-6">
      <div className="space-y-1">
        <Label htmlFor="settings-notification-email">Quote notification email</Label>
        <Input
          id="settings-notification-email"
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">New quote requests are sent here.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="settings-store-hours">Store hours</Label>
        <Textarea
          id="settings-store-hours"
          value={storeHours}
          onChange={(e) => setStoreHours(e.target.value)}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">One line per entry.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="settings-facebook-url">Facebook URL</Label>
        <Input
          id="settings-facebook-url"
          type="text"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
          placeholder="https://www.facebook.com/…"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="settings-instagram-url">Instagram URL</Label>
        <Input
          id="settings-instagram-url"
          type="text"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
          placeholder="https://www.instagram.com/…"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="settings-site-origin">Site origin</Label>
        <Input
          id="settings-site-origin"
          type="text"
          value={siteOrigin}
          onChange={(e) => setSiteOrigin(e.target.value)}
          placeholder="https://catering.example.com"
        />
        <p className="text-xs text-muted-foreground">Used for the sitemap.</p>
      </div>

      <Button type="submit" disabled={save.isPending}>
        Save settings
      </Button>
    </form>
  );
}
