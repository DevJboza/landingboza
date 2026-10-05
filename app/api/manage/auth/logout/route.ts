import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/manage/auth";
import { fail, validOrigin } from "@/lib/manage/api";
export async function POST(request: Request) {
  if (!validOrigin(request))
    return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  const response = NextResponse.json(
    { success: true, data: { authenticated: false } },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
