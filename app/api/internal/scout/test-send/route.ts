import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { fail } from "@/lib/manage/api";
import {
  ScoutTestPhoneError, scoutTestSendSchema, sendScoutTransportTest,
} from "@/lib/manage/scout-test-send";
import type { WhatsAppProvider } from "@/lib/manage/whatsapp";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.SCOUT_API_SECRET;
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret), actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function handleScoutTestSend(request: Request, provider?: WhatsAppProvider) {
  if (!process.env.SCOUT_API_SECRET) return fail("NOT_CONFIGURED", "Scout no configurado", 503);
  if (!authorized(request)) return fail("UNAUTHORIZED", "Acceso denegado", 401);
  const parsed = scoutTestSendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Solicitud de prueba inválida", 400,
    process.env.NODE_ENV !== "production" ? { issues: parsed.error.issues } : undefined);
  try {
    const result = await sendScoutTransportTest(parsed.data, provider);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof ScoutTestPhoneError)
      return fail("TEST_PHONE_NOT_ALLOWED", "Teléfono no autorizado para pruebas Scout", 403);
    const message = error instanceof Error ? error.message : "Error de transporte WhatsApp";
    return fail("SCOUT_TEST_SEND_FAILED", message.replace(/(token|authorization)=[^\s&]+/gi, "$1=[redacted]"), 502);
  }
}

export async function POST(request: Request) {
  return handleScoutTestSend(request);
}
