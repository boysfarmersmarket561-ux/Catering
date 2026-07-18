import { Suspense } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminSession, adminSignOut } from "@/server/admin-auth";
import { LoginForm } from "@/components/admin/login-form";
import { CatalogTree } from "@/components/admin/catalog-tree";
import { QuoteInbox } from "@/components/admin/quote-inbox";
import { StaffManager } from "@/components/admin/staff-manager";
import { SettingsForm } from "@/components/admin/settings-form";
import { adminQuotesQueryOptions } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — The Boys Catering" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => ({ session: await getAdminSession() }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = Route.useLoaderData();
  const router = useRouter();
  const { data: quotesForBadge } = useQuery({
    ...adminQuotesQueryOptions(),
    enabled: !!session,
  });
  const newCount = quotesForBadge?.filter((q) => q.status === "new").length ?? 0;

  if (!session) return <LoginForm />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl">Admin console</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {session.email}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await adminSignOut();
              await router.invalidate();
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="quotes">
            Quotes
            {newCount > 0 && <Badge className="ml-1.5">{newCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogue">
          <Suspense fallback={<p className="py-10 text-muted-foreground">Loading…</p>}>
            <CatalogTree />
          </Suspense>
        </TabsContent>
        <TabsContent value="quotes">
          <Suspense fallback={<p className="py-10 text-muted-foreground">Loading…</p>}>
            <QuoteInbox />
          </Suspense>
        </TabsContent>
        <TabsContent value="staff">
          <Suspense fallback={<p className="py-10 text-muted-foreground">Loading…</p>}>
            <StaffManager currentUserId={session.userId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="settings">
          <Suspense fallback={<p className="py-10 text-muted-foreground">Loading…</p>}>
            <SettingsForm />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
