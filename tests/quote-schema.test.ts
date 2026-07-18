import { describe, expect, it } from "vitest";
import { SubmitQuoteSchema } from "@/server/quotes";

const valid = {
  name: "Pat",
  email: "pat@example.com",
  phone: "",
  eventDate: "",
  guestCount: "",
  notes: "",
  website: "",
  lines: [{ itemId: "3f1c2f6e-9c1a-4b0e-8f5d-2a6c9d8e7b4a", tierId: null, quantity: 1 }],
};

describe("SubmitQuoteSchema", () => {
  it("accepts a minimal valid submission", () => {
    expect(SubmitQuoteSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a filled honeypot", () => {
    expect(SubmitQuoteSchema.safeParse({ ...valid, website: "spam.biz" }).success).toBe(false);
  });
  it("rejects empty lines, bad email, zero quantity", () => {
    expect(SubmitQuoteSchema.safeParse({ ...valid, lines: [] }).success).toBe(false);
    expect(SubmitQuoteSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(
      SubmitQuoteSchema.safeParse({
        ...valid,
        lines: [{ ...valid.lines[0], quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});
