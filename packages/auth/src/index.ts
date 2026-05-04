import { eq, and } from "drizzle-orm";
import { agents, tenants, approvals } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import type { CrmContext } from "@headless-crm/core";

export interface AgentToken {
  agentId: string;
  tenantId: string;
  role: "reader" | "operator" | "developer" | "auditor";
  collections?: string[];
}

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!_secret) {
    const raw = process.env.JWT_SECRET;
    if (!raw) throw new Error("JWT_SECRET is required");
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

/** Generate a unique API key: hcrm_sk_<32 random hex chars> */
function generateApiKey(): string {
  return `hcrm_sk_${randomBytes(24).toString("base64url")}`;
}

/** Hash an API key for secure storage comparison */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function createAuthService(db: any) {
  return {
    async provisionAgent(
      tenantId: string,
      input: {
        name: string;
        type?: "autonomous" | "supervised" | "scheduled" | "reactive";
        role?: "reader" | "operator" | "developer" | "auditor";
        ownerUserId?: string;
        metadata?: Record<string, unknown>;
      }
    ) {
      const id = `agent_${nanoid()}`;
      const apiKey = generateApiKey();

      // Auto-create tenant if it doesn't exist
      const existingTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (existingTenant.length === 0) {
        await db.insert(tenants).values({
          id: tenantId,
          name: tenantId.replace(/^tenant_/, "").replace(/_/g, " "),
          slug: tenantId.replace(/^tenant_/, ""),
        });
      }

      const isDeveloper = (input.role ?? "operator") === "developer";

      const [agent] = await db
        .insert(agents)
        .values({
          id,
          tenantId,
          name: input.name,
          type: input.type ?? "autonomous",
          role: input.role ?? "operator",
          status: isDeveloper ? "pending_approval" : "active",
          ownerUserId: input.ownerUserId,
          apiKey: hashApiKey(apiKey),
          metadata: input.metadata ?? {},
        })
        .returning();

      // If developer role, create a pending approval request
      let approval = null;
      if (isDeveloper) {
        const approvalId = nanoid();
        [approval] = await db
          .insert(approvals)
          .values({
            id: approvalId,
            tenantId,
            type: "agent_provision",
            status: "pending",
            requestedByAgentId: id,
            title: `Developer agent provisioning: ${input.name}`,
            description: `Agent "${input.name}" is requesting developer-level access. This role grants full permissions including delete and schema modifications.`,
            metadata: { agentId: id, agentName: input.name, role: "developer", type: input.type ?? "autonomous" },
          })
          .returning();
      }

      const token = await this.createToken({
        agentId: id,
        tenantId,
        role: agent.role,
      });

      // Return the raw API key (only shown once, stored as hash)
      return {
        agent: { ...agent, apiKey: undefined },
        token,
        apiKey,
        ...(approval ? { pendingApproval: approval } : {}),
      };
    },

    async createToken(payload: AgentToken): Promise<string> {
      return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(getSecret());
    },

    async verifyToken(token: string): Promise<AgentToken> {
      const { payload } = await jwtVerify(token, getSecret());
      return payload as unknown as AgentToken;
    },

    /** Resolve auth context from either a JWT Bearer token or an API key */
    async resolveContext(credential: string): Promise<CrmContext> {
      let agentId: string;
      let tenantId: string;

      let role: "reader" | "operator" | "developer" | "auditor" = "reader";

      if (credential.startsWith("hcrm_sk_")) {
        // API key auth — hash and look up
        const hashed = hashApiKey(credential);
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.apiKey, hashed))
          .limit(1);

        if (!agent) throw new Error("Invalid API key");
        if (agent.status !== "active") throw new Error("Agent is not active");

        agentId = agent.id;
        tenantId = agent.tenantId;
        role = agent.role ?? "reader";
      } else {
        // JWT auth
        const payload = await this.verifyToken(credential);
        agentId = payload.agentId;
        tenantId = payload.tenantId;
        role = payload.role ?? "reader";
      }

      // Update last_active_at
      await db
        .update(agents)
        .set({ lastActiveAt: new Date() })
        .where(eq(agents.id, agentId));

      return { tenantId, agentId, role };
    },

    /** Resolve full agent record from API key (for permission checks) */
    async resolveAgentFromKey(apiKey: string) {
      const hashed = hashApiKey(apiKey);
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.apiKey, hashed))
        .limit(1);
      return agent ?? null;
    },

    async activateAgent(tenantId: string, agentId: string) {
      const [agent] = await db
        .update(agents)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
        .returning();
      if (!agent) throw new Error("Agent not found");
      return agent;
    },

    async suspendAgent(tenantId: string, agentId: string) {
      const [agent] = await db
        .update(agents)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
        .returning();
      if (!agent) throw new Error("Agent not found");
      return agent;
    },

    async decommissionAgent(tenantId: string, agentId: string) {
      const [agent] = await db
        .update(agents)
        .set({ status: "decommissioned", updatedAt: new Date() })
        .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
        .returning();
      if (!agent) throw new Error("Agent not found");
      return agent;
    },

    /** Rotate an agent's API key — invalidates the old one */
    async rotateApiKey(tenantId: string, agentId: string) {
      const newKey = generateApiKey();
      const [agent] = await db
        .update(agents)
        .set({ apiKey: hashApiKey(newKey), updatedAt: new Date() })
        .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
        .returning();
      if (!agent) throw new Error("Agent not found");
      return { agent: { ...agent, apiKey: undefined }, apiKey: newKey };
    },

    checkPermission(
      token: AgentToken,
      action: "read" | "create" | "update" | "delete" | "schema" | "audit",
      collection?: string
    ): boolean {
      // "audit" gates access to the audit trail / event log.
      // - reader / operator: can read CRM data but NOT the audit log
      // - auditor: read + audit (no writes; sees all agent activity)
      // - developer: full incl. audit
      const rolePermissions: Record<string, Set<string>> = {
        reader: new Set(["read"]),
        operator: new Set(["read", "create", "update"]),
        developer: new Set(["read", "create", "update", "delete", "schema", "audit"]),
        auditor: new Set(["read", "audit"]),
      };

      const allowed = rolePermissions[token.role];
      if (!allowed?.has(action)) return false;

      if (collection && token.collections && token.collections.length > 0) {
        return token.collections.includes(collection);
      }

      return true;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
