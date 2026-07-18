import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getAdminSession, adminSignOut } from "@/server/admin-auth";
import { LoginForm } from "@/components/admin/login-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogue">
          <p className="py-10 text-muted-foreground">
            Catalogue management arrives in the next task.
          </p>
        </TabsContent>
        <TabsContent value="quotes">
          <p className="py-10 text-muted-foreground">Quote inbox arrives in a later task.</p>
        </TabsContent>
        <TabsContent value="staff">
          <p className="py-10 text-muted-foreground">Staff management arrives in a later task.</p>
        </TabsContent>
        <TabsContent value="settings">
          <p className="py-10 text-muted-foreground">Settings arrive in a later task.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
