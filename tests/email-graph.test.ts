import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = {
  tenantId: "tenant-1",
  clientId: "client-1",
  clientSecret: "secret-1",
  mailbox: "catering@example.com",
};

const msg = {
  to: "customer@example.com",
  subject: "Your quote",
  html: "<p>Hello</p>",
  text: "Hello",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, body: string) {
  return new Response(body, { status });
}

async function freshGraphModule() {
  vi.resetModules();
  return await import("@/lib/email/graph");
}

describe("createGraphSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends via Graph on the happy path", async () => {
    const { createGraphSender } = await freshGraphModule();
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      calls.push({ url: urlStr, init });
      if (urlStr.includes("/oauth2/v2.0/token")) {
        return jsonResponse(200, { access_token: "t1", expires_in: 3600 });
      }
      if (urlStr.includes("/sendMail")) {
        return textResponse(202, "");
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = createGraphSender(cfg);
    await expect(sender.send(msg)).resolves.toBeUndefined();

    const sendMailCall = calls.find((c) => c.url.includes("/sendMail"));
    expect(sendMailCall).toBeDefined();
    expect(sendMailCall!.url).toContain(encodeURIComponent(cfg.mailbox));

    const headers = sendMailCall!.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer t1");

    const body = JSON.parse(sendMailCall!.init?.body as string);
    expect(body.message.subject).toBe(msg.subject);
    expect(body.message.body.contentType).toBe("HTML");
    expect(body.message.toRecipients[0].emailAddress.address).toBe(msg.to);
  });

  it("caches the token across two sends, hitting the token endpoint only once", async () => {
    const { createGraphSender } = await freshGraphModule();
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/oauth2/v2.0/token")) {
        tokenCalls += 1;
        return jsonResponse(200, { access_token: "t1", expires_in: 3600 });
      }
      if (urlStr.includes("/sendMail")) {
        return textResponse(202, "");
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = createGraphSender(cfg);
    await sender.send(msg);
    await sender.send(msg);

    expect(tokenCalls).toBe(1);
  });

  it("rejects with a clear message when the token request fails", async () => {
    const { createGraphSender } = await freshGraphModule();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/oauth2/v2.0/token")) {
        return textResponse(401, "invalid_client");
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = createGraphSender(cfg);
    await expect(sender.send(msg)).rejects.toThrow(/Graph token request failed/);
  });

  it("rejects with a clear message when sendMail fails", async () => {
    const { createGraphSender } = await freshGraphModule();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/oauth2/v2.0/token")) {
        return jsonResponse(200, { access_token: "t1", expires_in: 3600 });
      }
      if (urlStr.includes("/sendMail")) {
        return textResponse(403, "Forbidden: insufficient privileges");
      }
      throw new Error(`Unexpected fetch: ${urlStr}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = createGraphSender(cfg);
    await expect(sender.send(msg)).rejects.toThrow(/Graph sendMail failed: 403/);
  });
});
