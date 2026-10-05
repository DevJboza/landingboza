import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/manage/api";
const schema = z.object({
  event: z.literal("messages.post"),
  data: z.object({
    id: z.string(),
    from: z.string(),
    body: z.string().max(10000),
  }),
});
export async function POST(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return fail("NOT_CONFIGURED", "Webhook no configurado", 503);
  const raw = await request.text();
  const given = request.headers.get("x-webhook-signature") || "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(given),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return fail("INVALID_SIGNATURE", "Firma inválida", 401);
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Payload inválido", 400);
  return ok({ accepted: true, eventId: parsed.data.data.id }, 202);
}
export function GET() {
  return fail("METHOD_NOT_ALLOWED", "Método no permitido", 405);
}
