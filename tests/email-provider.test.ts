import { describe, expect, it } from "vitest";
import { getEmailSender } from "@/lib/email";

describe("getEmailSender", () => {
  it("returns a resend sender when configured", () => {
    const s = getEmailSender({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "a@b.c",
    });
    expect(typeof s.send).toBe("function");
  });
  it("defaults to resend when EMAIL_PROVIDER is unset", () => {
    const s = getEmailSender({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c" });
    expect(typeof s.send).toBe("function");
  });
  it("throws when resend config is missing", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
  });
  it("throws on unknown provider", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "pigeon" })).toThrow(/Unknown EMAIL_PROVIDER/);
  });
  it("throws when graph config is missing", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "graph" })).toThrow(/AZURE_TENANT_ID/);
  });
});
