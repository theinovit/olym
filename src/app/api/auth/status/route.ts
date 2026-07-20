import { hasAdminAccount } from "@/server/auth";

export async function GET() {
  return Response.json({ hasAccount: await hasAdminAccount() });
}
