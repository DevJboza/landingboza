import { NextResponse } from "next/server";
import { hasSession } from "./auth";

export const ok = (data: unknown, status = 200) =>
  NextResponse.json(
    { success: true, data },
    { status, headers: { "Cache-Control": "no-store, private" } },
  );
export const fail = (code: string, message: string, status: number, details?: Record<string, unknown>) =>
  NextResponse.json(
    { success: false, error: { code, message, ...details } },
    { status, headers: { "Cache-Control": "no-store, private" } },
  );
export async function requireApiSession() {
  return (await hasSession())
    ? null
    : fail("UNAUTHORIZED", "Autenticación requerida", 401);
}
export function validOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
