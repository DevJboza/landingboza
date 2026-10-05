type Json = Record<string, unknown>;
async function serverRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Integration request failed (${response.status})`);
  return response.json() as Promise<Json>;
}
export async function sendAgentCommand(payload: Json) {
  const base = process.env.N8N_BASE_URL,
    key = process.env.N8N_API_KEY;
  if (!base || !key) throw new Error("n8n is not configured");
  return serverRequest(`${base}/webhook/agent-command`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
}
export async function triggerWorkflow(path: string, payload: Json) {
  const base = process.env.N8N_BASE_URL,
    secret = process.env.N8N_WEBHOOK_SECRET;
  if (!base || !secret) throw new Error("n8n is not configured");
  return serverRequest(
    `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
    {
      method: "POST",
      headers: { "X-Webhook-Secret": secret },
      body: JSON.stringify(payload),
    },
  );
}
export async function getAgentStatus() {
  const base = process.env.N8N_BASE_URL,
    key = process.env.N8N_API_KEY;
  if (!base || !key) return { configured: false };
  return serverRequest(`${base}/api/agent/status`, {
    headers: { Authorization: `Bearer ${key}` },
  });
}
export async function sendTextMessage(phone: string, text: string) {
  const url = process.env.WASENDER_API_URL || "https://api.wasender.dev",
    token = process.env.WASENDER_API_TOKEN;
  if (!token) throw new Error("WaSender is not configured");
  return serverRequest(`${url.replace(/\/$/, "")}/messages/text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: phone.replace(/\D/g, ""), body: text }),
  });
}
export async function getWhatsAppStatus() {
  const url = process.env.WASENDER_API_URL || "https://api.wasender.dev",
    token = process.env.WASENDER_API_TOKEN;
  if (!token) return { configured: false };
  return serverRequest(`${url.replace(/\/$/, "")}/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export async function checkOpenRouter() {
  return { configured: Boolean(process.env.OPENROUTER_API_KEY) };
}
