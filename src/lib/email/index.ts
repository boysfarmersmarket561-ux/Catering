import type { EmailSender } from "./types";
import { createResendSender } from "./resend";
import { createGraphSender } from "./graph";

type Env = Record<string, string | undefined>;

function req(env: Env, name: string): string {
  const v = env[name];
  if (!v)
    throw new Error(`${name} is required for EMAIL_PROVIDER=${env.EMAIL_PROVIDER ?? "resend"}`);
  return v;
}

export function getEmailSender(env: Env = process.env): EmailSender {
  const provider = env.EMAIL_PROVIDER ?? "resend";
  if (provider === "resend") {
    return createResendSender({ apiKey: req(env, "RESEND_API_KEY"), from: req(env, "EMAIL_FROM") });
  }
  if (provider === "graph") {
    return createGraphSender({
      tenantId: req(env, "AZURE_TENANT_ID"),
      clientId: req(env, "AZURE_CLIENT_ID"),
      clientSecret: req(env, "AZURE_CLIENT_SECRET"),
      mailbox: req(env, "GRAPH_SENDER_MAILBOX"),
    });
  }
  throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
}
