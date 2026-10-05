import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: "env.local", override: false });

const result: {
  wasender: string;
  n8n: string;
  openrouter: string;
  wasenderHttp?: number;
} = {
  wasender: process.env.WASENDER_API_TOKEN ? "configured" : "not configured",
  n8n:
    process.env.N8N_BASE_URL &&
    process.env.N8N_API_KEY &&
    process.env.N8N_WEBHOOK_SECRET
      ? "configured"
      : "not configured",
  openrouter: process.env.OPENROUTER_API_KEY ? "configured" : "not configured",
};
if (process.env.WASENDER_API_TOKEN) {
  const base = (
    process.env.WASENDER_API_URL || "https://api.wasender.dev"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/health`, {
      headers: { Authorization: `Bearer ${process.env.WASENDER_API_TOKEN}` },
    });
    result.wasenderHttp = response.status;
    result.wasender = response.ok
      ? "reachable"
      : "configured; status endpoint unavailable";
  } catch {
    result.wasender = "configured; network error";
  }
}
console.log(JSON.stringify(result));
