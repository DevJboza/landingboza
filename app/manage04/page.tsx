import { hasSession } from "@/lib/manage/auth";
import { repository } from "@/lib/manage/repository";
import Login from "./ui/login";
import ControlCenter from "./ui/control-center";

export const dynamic = "force-dynamic";
export default async function ManagePage() {
  if (!(await hasSession()))
    return (
      <Login
        configured={Boolean(
          process.env.MANAGE04_PASSWORD_HASH && process.env.SESSION_SECRET,
        )}
      />
    );
  const [
    dashboard,
    conversations,
    prospects,
    leads,
    quotes,
    followups,
    outreach,
    agent,
  ] = await Promise.all([
    repository.dashboard(),
    repository.conversations(),
    repository.prospects(),
    repository.leads(),
    repository.quotes(),
    repository.followups(),
    repository.outreach(),
    repository.agent(),
  ]);
  return (
    <ControlCenter
      initial={{
        dashboard,
        conversations,
        prospects,
        leads,
        quotes,
        followups,
        outreach,
        agent,
      }}
    />
  );
}
