import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "boza_manage_session";
const SESSION_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    return process.env.NODE_ENV === "production"
      ? null
      : "boza-local-development-secret-change-me";
  return value;
}
function sign(value: string, key: string) {
  return createHmac("sha256", key).update(value).digest("base64url");
}
export function createSessionToken() {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not configured");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "admin",
      iat: Date.now(),
      exp: Date.now() + SESSION_SECONDS * 1000,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}
export function verifySessionToken(token?: string) {
  if (!token) return false;
  const key = secret();
  if (!key) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub: string;
      exp: number;
    };
    return data.sub === "admin" && data.exp > Date.now();
  } catch {
    return false;
  }
}
export async function hasSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
export async function verifyPassword(password: string) {
  const hash = process.env.MANAGE04_PASSWORD_HASH;
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};
