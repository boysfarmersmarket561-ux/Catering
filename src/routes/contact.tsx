import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { baseMenu } from "@/data/menu";
import { settingsQueryOptions } from "@/lib/queries";
import { MapPin, Phone, Mail, Clock, Printer } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & About — The Boys Farmers Market Catering" },
      {
        name: "description",
        content:
          "Visit The Boys Farmers Market at 14378 S. Military Trail, Delray Beach FL. Open daily 8:30am–6:00pm. Call (561) 496-0810.",
      },
      { property: "og:title", content: "Contact — The Boys Farmers Market" },
      {
        property: "og:description",
        content:
          "Delray Beach's gourmet farmers market and catering kitchen. Open every day, 8:30am–6:00pm.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useQuery(settingsQueryOptions());
  const b = baseMenu.business;
  const mapQuery = encodeURIComponent(
    `${b.address.street}, ${b.address.city}, ${b.address.state} ${b.address.zip}`,
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      <header className="mb-14">
        <span className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Visit us
        </span>
        <h1 className="mt-3 font-display text-6xl md:text-7xl">Contact & About</h1>
        <p className="mt-5 max-w-2xl text-xl italic text-muted-foreground">{b.tagline}</p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-6 rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
          <Row icon={<MapPin className="h-5 w-5" />} title="Address">
            {b.address.street}
            <br />
            {b.address.city}, {b.address.state} {b.address.zip}
          </Row>
          <Row icon={<Phone className="h-5 w-5" />} title="Phone">
            <a className="hover:underline" href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`}>
              {b.phone}
            </a>
          </Row>
          <Row icon={<Printer className="h-5 w-5" />} title="Fax">
            {b.fax}
          </Row>
          <Row icon={<Mail className="h-5 w-5" />} title="Bakery / catering email">
            <a className="hover:underline" href={`mailto:${b.bakery_email}`}>
              {b.bakery_email}
            </a>
          </Row>
          <Row icon={<Clock className="h-5 w-5" />} title="Hours">
            {settings?.store_hours.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </Row>
        </section>

        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="aspect-video w-full bg-primary/5">
            <iframe
              title="Map"
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
            />
          </div>
          <div className="space-y-3 p-6">
            <h3 className="font-display text-3xl">About the market</h3>
            <p className="text-muted-foreground">
              For decades, The Boys Farmers Market has been Delray Beach's beloved source for
              handpicked produce, artisan cheeses, prepared foods, and gourmet catering. Our kitchen
              team crafts each platter and entrée in-house — bringing the flavors of the market
              straight to your table.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </div>
        <div className="mt-0.5 text-base">{children}</div>
      </div>
    </div>
  );
}
