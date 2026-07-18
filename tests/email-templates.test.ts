import { describe, expect, it } from "vitest";
import {
  businessNotificationEmail,
  customerConfirmationEmail,
  type QuoteEmailData,
} from "@/lib/email/templates";

const data: QuoteEmailData = {
  reference: "ABCD2345",
  customerName: "Pat Jones",
  customerEmail: "pat@example.com",
  customerPhone: "561-555-0100",
  eventDate: "2026-08-01",
  guestCount: "40",
  notes: "Nut allergy at table 2",
  lines: [
    {
      itemId: "i1",
      itemName: "Fruit Platter",
      categoryName: "Fresh Fruit",
      sectionName: "Platters",
      tierLabel: "Large",
      unit: "platter",
      unitAmount: 89.99,
      quantity: 2,
    },
    {
      itemId: "i2",
      itemName: "Carving Station",
      categoryName: "Main Entrees",
      sectionName: "Stations",
      tierLabel: null,
      unit: null,
      unitAmount: null,
      quantity: 1,
    },
  ],
  subtotal: 179.98,
  hasUnpriced: true,
};

describe("businessNotificationEmail", () => {
  const m = businessNotificationEmail(data);
  it("subject carries reference and customer", () => {
    expect(m.subject).toContain("ABCD2345");
    expect(m.subject).toContain("Pat Jones");
  });
  it("body lists lines, prices, unpriced flag and contact details", () => {
    for (const part of [
      "Fruit Platter",
      "$89.99",
      "× 2",
      "Carving Station",
      "Price on request",
      "$179.98",
      "pat@example.com",
      "561-555-0100",
      "Nut allergy",
    ]) {
      expect(m.text).toContain(part);
      expect(m.html).toContain(part.replace("×", "&times;"));
    }
  });
});

describe("customerConfirmationEmail", () => {
  const m = customerConfirmationEmail(data);
  it("subject carries the reference", () => {
    expect(m.subject).toContain("ABCD2345");
  });
  it("body includes order copy and subtotal disclaimer", () => {
    expect(m.text).toContain("Fruit Platter");
    expect(m.text).toContain("$179.98");
    expect(m.text.toLowerCase()).toContain("estimate");
  });
});
