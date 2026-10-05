import { config } from "dotenv";
config({path:".env.local"});
import postgres from "postgres";
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is not configured");
const sql=postgres(process.env.DATABASE_URL,{prepare:false,max:1,connect_timeout:30});
const [counts,recentMessages,recentConversations]=await Promise.all([
  sql`select (select count(*)::int from contacts) contacts,(select count(*)::int from conversations) conversations,(select count(*)::int from messages) messages`,
  sql`select id,conversation_id,external_id,direction,sender_type,status,length(body)::int body_length,created_at from messages order by created_at desc limit 10`,
  sql`select c.id,c.contact_id,c.agent_mode,c.last_message_at,length(c.last_message)::int preview_length,ct.phone from conversations c left join contacts ct on ct.id=c.contact_id order by c.last_message_at desc limit 10`
]);
const mask=(value:unknown)=>{const text=String(value||"");return text.length>4?`${"*".repeat(Math.max(0,text.length-4))}${text.slice(-4)}`:"****"};
console.log(JSON.stringify({counts:counts[0],recentMessages:recentMessages.map(row=>({...row,external_id:row.external_id?mask(row.external_id):null})),recentConversations:recentConversations.map(row=>({...row,phone:mask(row.phone)}))},null,2));
await sql.end();
