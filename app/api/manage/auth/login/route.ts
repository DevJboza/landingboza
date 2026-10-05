import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/manage/auth";
import { fail, validOrigin } from "@/lib/manage/api";

const schema = z.object({ password: z.string().min(1).max(200) });
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && record.reset > now && record.count >= 5)
    return fail(
      "TOO_MANY_ATTEMPTS",
      "Demasiados intentos. Intenta más tarde.",
      429,
    );
  let parsed;
  try {
    parsed = schema.safeParse(await request.json());
  } catch {
    return fail("INVALID_REQUEST", "Credenciales inválidas", 400);
  }
  if (!parsed.success)
    return fail("INVALID_REQUEST", "Credenciales inválidas", 400);
  if (!(await verifyPassword(parsed.data.password))) {
    const current =
      record && record.reset > now
        ? record
        : { count: 0, reset: now + 15 * 60_000 };
    current.count++;
    attempts.set(ip, current);
    await new Promise((r) => setTimeout(r, 350));
    return fail("INVALID_CREDENTIALS", "Credenciales inválidas", 401);
  }
  attempts.delete(ip);
  let token;
  try {
    token = createSessionToken();
  } catch {
    return fail("AUTH_NOT_CONFIGURED", "Acceso no configurado", 503);
  }
  const response = NextResponse.json(
    { success: true, data: { authenticated: true } },
    { headers: { "Cache-Control": "no-store, private" } },
  );
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
