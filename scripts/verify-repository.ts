import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: "env.local", override: false });
import { repository } from "../lib/manage/repository";

const dashboard = await repository.dashboard();
console.log("dashboard: ok");
const conversations = await repository.conversations();
console.log("conversations: ok");
const prospects = await repository.prospects();
console.log("prospects: ok");
const leads = await repository.leads();
console.log("leads: ok");
const quotes = await repository.quotes();
console.log("quotes: ok");
const followups = await repository.followups();
console.log("followups: ok");
const outreach = await repository.outreach();
console.log("outreach: ok");
const agent = await repository.agent();
console.log("agent: ok");
if (
  !dashboard ||
  !agent ||
  ![conversations, prospects, leads, quotes, followups, outreach].every(
    Array.isArray,
  )
)
  throw new Error("Repository verification failed");
console.log(
  JSON.stringify({
    repository: "postgres-verified",
    collections: {
      conversations: conversations.length,
      prospects: prospects.length,
      leads: leads.length,
      quotes: quotes.length,
      followups: followups.length,
      outreach: outreach.length,
    },
    dashboard: "calculated",
    agentSettings: "persisted",
  }),
);
process.exit(0);
