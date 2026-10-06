import { timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/lib/manage/api";
import { importScoutBatch, ScoutTestModeError, scoutImportSchema } from "@/lib/manage/scout";

export const runtime = "nodejs";

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
  const parsed = scoutImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail(
      "INVALID_PAYLOAD",
      "Lote Scout inválido",
      400,
      process.env.NODE_ENV !== "production" ? { issues: parsed.error.issues } : undefined,
    );
  try {
    return ok(await importScoutBatch(parsed.data), 201);
  } catch (error) {
    if (error instanceof ScoutTestModeError)
      return fail(error.code, "Teléfono no autorizado para pruebas Scout", 400);
    throw error;
  }
}
