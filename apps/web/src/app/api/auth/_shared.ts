import { auth } from "@headless-crm/auth-web";
import { getDb } from "@headless-crm/db";
import { users } from "@headless-crm/db";
import { eq } from "drizzle-orm";

export interface FreshSessionUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  tenantId: string | null;
}

export async function getFreshSessionUser(headers: Headers): Promise<FreshSessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const db = getDb();
  const [freshUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (freshUser as FreshSessionUser | undefined) ?? null;
}
