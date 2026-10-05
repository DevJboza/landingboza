import { timingSafeEqual } from "node:crypto";
export function authorizeInternal(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return false;
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const supplied = request.headers.get("x-internal-secret") || bearer || "";
  const a = Buffer.from(supplied),
    b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
