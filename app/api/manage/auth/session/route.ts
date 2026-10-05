import { hasSession } from "@/lib/manage/auth";
import { ok } from "@/lib/manage/api";
export async function GET() {
  return ok({ authenticated: await hasSession() });
}
