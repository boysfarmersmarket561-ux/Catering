import { createFileRoute } from "@tanstack/react-router";
import { useMenu } from "@/lib/menu-store";
import { MenuBrowser } from "@/components/menu-browser";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Catering Menu — The Boys Farmers Market" },
      {
        name: "description",
        content:
          "Full gourmet catering menu — fruit and vegetable platters, cheese, wine, appetizers, entrees, seafood, and desserts.",
      },
      { property: "og:title", content: "Catering Menu — The Boys Farmers Market" },
      {
        property: "og:description",
        content: "230+ gourmet catering items across 8 categories. Browse, filter, and build a quote.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const menu = useMenu();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">Menu</span>
        <h1 className="mt-1 font-display text-5xl">The Full Catering Menu</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Browse every platter, entrée, and dessert we cater. Add items to build a quote — we'll follow up with
          confirmation, dietary options, and delivery details.
        </p>
      </header>
      <MenuBrowser data={menu} />
    </div>
  );
}