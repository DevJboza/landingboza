import { z } from "zod";
import { fail, ok, requireApiSession, validOrigin } from "@/lib/manage/api";
import { repository } from "@/lib/manage/repository";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  requestId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  if (!validOrigin(request)) return fail("INVALID_ORIGIN", "Solicitud rechazada", 403);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail("INVALID_PAYLOAD", "Mensaje inválido", 400);
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_PAYLOAD", "Mensaje inválido", 400);
  try {
    return ok(
      await repository.sendMessage(
        parsed.data.conversationId,
        parsed.data.body,
        parsed.data.requestId,
      ),
      201,
    );
  } catch {
    return fail("MESSAGE_FAILED", "No fue posible enviar el mensaje", 502);
  }
}
