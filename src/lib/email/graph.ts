import type { EmailSender } from "./types";

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(cfg: GraphConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export function createGraphSender(cfg: GraphConfig): EmailSender {
  return {
    async send(msg) {
      const token = await getToken(cfg);
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/sendMail`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: msg.subject,
              body: { contentType: "HTML", content: msg.html },
              toRecipients: [{ emailAddress: { address: msg.to } }],
            },
            saveToSentItems: true,
          }),
        },
      );
      // Graph returns 202 Accepted on success
      if (res.status !== 202)
        throw new Error(`Graph sendMail failed: ${res.status} ${await res.text()}`);
    },
  };
}
