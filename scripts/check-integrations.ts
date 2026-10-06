import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: "env.local", override: false });

const configured = Boolean(
  process.env.GREEN_API_URL &&
    process.env.GREEN_API_INSTANCE_ID &&
    process.env.GREEN_API_TOKEN,
);
const result: Record<string, unknown> = {
  whatsappProvider: process.env.WHATSAPP_PROVIDER || "GREEN_API",
  greenApi: configured ? "configured" : "not configured",
  greenApiWebhook: process.env.GREEN_API_WEBHOOK_TOKEN
    ? "configured"
    : "not configured",
  n8n: process.env.N8N_AGENT_WEBHOOK_URL ? "configured" : "not configured",
  openrouter: process.env.OPENROUTER_API_KEY ? "configured" : "not configured",
};
if (configured) {
  const base = process.env.GREEN_API_URL!.replace(/\/$/, "");
  try {
    const response = await fetch(
      `${base}/waInstance${process.env.GREEN_API_INSTANCE_ID}/getStateInstance/${process.env.GREEN_API_TOKEN}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const body = (await response.json().catch(() => ({}))) as {
      stateInstance?: string;
    };
    result.greenApiHttp = response.status;
    result.greenApiStatus = body.stateInstance || "unknown";
  } catch {
    result.greenApiStatus = "network error";
  }
}
console.log(JSON.stringify(result));
