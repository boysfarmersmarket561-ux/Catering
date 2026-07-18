import type { EmailSender } from "./types";

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
}

export function createGraphSender(cfg: GraphConfig): EmailSender {
  void cfg;
  return {
    async send() {
      throw new Error("Graph sender not implemented yet — see Phase 4");
    },
  };
}
