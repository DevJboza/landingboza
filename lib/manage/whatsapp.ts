type Json = Record<string, unknown>;

export type WhatsAppStatus = {
  provider: "GREEN_API" | "WASENDER";
  configured: boolean;
  status: string;
};

export interface WhatsAppProvider {
  readonly name: "GREEN_API" | "WASENDER";
  sendText(chatIdOrPhone: string, message: string): Promise<{ externalId: string; raw: Json }>;
  getStatus(): Promise<WhatsAppStatus>;
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) throw new Error(`WhatsApp request failed (${response.status})`);
  return body;
}

function personalChatId(value: string) {
  if (value.endsWith("@g.us")) throw new Error("Group messages are not allowed");
  if (value.endsWith("@c.us")) return value;
  const digits = value.replace(/@.*$/, "").replace(/\D/g, "");
  const phone = digits.length === 8 ? `506${digits}` : digits;
  if (!phone || phone.length < 10) throw new Error("Invalid WhatsApp destination");
  return `${phone}@c.us`;
}

export class GreenApiProvider implements WhatsAppProvider {
  readonly name = "GREEN_API" as const;
  private config() {
    const url = process.env.GREEN_API_URL;
    const instance = process.env.GREEN_API_INSTANCE_ID;
    const token = process.env.GREEN_API_TOKEN;
    if (!url || !instance || !token) throw new Error("GREEN-API is not configured");
    return { url: url.replace(/\/$/, ""), instance, token };
  }
  async sendText(chatIdOrPhone: string, message: string) {
    const { url, instance, token } = this.config();
    const raw = await jsonRequest(
      `${url}/waInstance${instance}/sendMessage/${token}`,
      {
        method: "POST",
        body: JSON.stringify({ chatId: personalChatId(chatIdOrPhone), message }),
      },
    );
    const externalId = typeof raw.idMessage === "string" ? raw.idMessage : "";
    if (!externalId) throw new Error("GREEN-API response has no idMessage");
    return { externalId, raw };
  }
  async getStatus() {
    const configured = Boolean(
      process.env.GREEN_API_URL &&
        process.env.GREEN_API_INSTANCE_ID &&
        process.env.GREEN_API_TOKEN,
    );
    if (!configured)
      return { provider: this.name, configured: false, status: "not configured" };
    const { url, instance, token } = this.config();
    try {
      const data = await jsonRequest(
        `${url}/waInstance${instance}/getStateInstance/${token}`,
      );
      return {
        provider: this.name,
        configured: true,
        status: typeof data.stateInstance === "string" ? data.stateInstance : "error",
      };
    } catch {
      return { provider: this.name, configured: true, status: "error" };
    }
  }
}

class LegacyWaSenderProvider implements WhatsAppProvider {
  readonly name = "WASENDER" as const;
  async sendText(chatIdOrPhone: string, message: string) {
    const url = process.env.WASENDER_API_URL || "https://api.wasender.dev";
    const token = process.env.WASENDER_API_TOKEN;
    if (!token) throw new Error("WaSender is not configured");
    const raw = await jsonRequest(`${url.replace(/\/$/, "")}/messages/text`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: chatIdOrPhone.replace(/\D/g, ""), body: message }),
    });
    const remote = raw.message as Json | undefined;
    const externalId = remote?.id ? String(remote.id) : "";
    if (!externalId) throw new Error("WaSender response has no message id");
    return { externalId, raw };
  }
  async getStatus() {
    return {
      provider: this.name,
      configured: Boolean(process.env.WASENDER_API_TOKEN),
      status: process.env.WASENDER_API_TOKEN ? "legacy" : "not configured",
    };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === "WASENDER"
    ? new LegacyWaSenderProvider()
    : new GreenApiProvider();
}

export function greenApiConfiguration() {
  return {
    apiUrlConfigured: Boolean(process.env.GREEN_API_URL),
    instanceConfigured: Boolean(process.env.GREEN_API_INSTANCE_ID),
    tokenConfigured: Boolean(process.env.GREEN_API_TOKEN),
    instanceId: process.env.GREEN_API_INSTANCE_ID || null,
  };
}

export async function configureGreenApiWebhook(webhookUrl: string) {
  const url = process.env.GREEN_API_URL;
  const instance = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  const webhookToken = process.env.GREEN_API_WEBHOOK_TOKEN;
  if (!url || !instance || !token || !webhookToken)
    throw new Error("GREEN-API webhook is not configured");
  await jsonRequest(
    `${url.replace(/\/$/, "")}/waInstance${instance}/setSettings/${token}`,
    {
      method: "POST",
      body: JSON.stringify({
        webhookUrl,
        webhookUrlToken: `Bearer ${webhookToken.replace(/^Bearer\s+/i, "")}`,
        incomingWebhook: "yes",
        outgoingWebhook: "yes",
        outgoingMessageWebhook: "yes",
        outgoingAPIMessageWebhook: "yes",
        stateWebhook: "yes",
      }),
    },
  );
  return { configured: true, webhookUrl };
}
