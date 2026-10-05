import { hasSession } from "@/lib/manage/auth";
import { repository } from "@/lib/manage/repository";
import Login from "./ui/login";
import ControlCenter from "./ui/control-center";
export const dynamic="force-dynamic";
export default async function ManagePage(){if(!(await hasSession()))return <Login configured={Boolean(process.env.MANAGE04_PASSWORD_HASH&&process.env.SESSION_SECRET)}/>;return <ControlCenter initial={{dashboard:repository.dashboard(),conversations:repository.conversations(),prospects:repository.prospects(),leads:repository.leads(),quotes:repository.quotes(),followups:repository.followups(),outreach:repository.outreach(),agent:repository.agent()}}/>}
