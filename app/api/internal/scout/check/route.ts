import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/manage/api";
import { checkScoutCandidate } from "@/lib/manage/scout";

const schema = z.object({
  businessName: z.string().trim().min(2), city: z.string().trim().min(2),
  canton: z.string().trim().default("Pérez Zeledón"), phone: z.string().nullable().default(null),
  whatsapp: z.string().nullable().default(null), website: z.string().url().nullable().default(null),
});
function authorized(request: Request) {
  const secret = process.env.SCOUT_API_SECRET;
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret), actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function POST(request: Request) {
  if (!process.env.SCOUT_API_SECRET) return fail("NOT_CONFIGURED", "Scout no configurado", 503);
  if (!authorized(request)) return fail("UNAUTHORIZED", "Acceso denegado", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Consulta inválida", 400);
  return ok(await checkScoutCandidate(parsed.data));
}
