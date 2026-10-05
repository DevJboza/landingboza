import { hasSession } from "@/lib/manage/auth";
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
  return (
    <ControlCenter
      initial={{
        dashboard: {
          metrics: {
            activeConversations: 0,
            newProspects: 0,
            hotLeads: 0,
            pendingQuotes: 0,
            todayFollowups: 0,
            meetings: 0,
            responseRate: 0,
            messagesProcessed: 0,
            humanChats: 0,
            activeSessions: 0,
          },
          activity: [0, 0, 0, 0, 0, 0, 0],
          activities: [],
          leadFunnel: [
            { name: "Nuevos", value: 0 },
            { name: "Contactados", value: 0 },
            { name: "Interesados", value: 0 },
            { name: "Cotización", value: 0 },
            { name: "Ganados", value: 0 },
          ],
          agentOnline: false,
        },
        conversations: [],
        prospects: [],
        leads: [],
        quotes: [],
        followups: [],
        outreach: [],
        agent: {
          online: false,
          model: "OpenRouter",
          provider: "WaSender",
          activeSessions: 0,
          messagesProcessed: 0,
          fallbacks: 0,
          humanChats: 0,
          settings: {
            closeMinutes: 10,
            reminderMinutes: 7,
            autoReply: true,
            aiFallback: true,
            afterHours: false,
          },
        },
      }}
    />
  );
}
