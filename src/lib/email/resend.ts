import type { EmailSender } from "./types";

export function createResendSender(opts: { apiKey: string; from: string }): EmailSender {
  return {
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: opts.from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    },
  };
}
