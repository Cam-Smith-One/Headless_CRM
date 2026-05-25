import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTools, type ToolDeps } from "./tools/index";

// Role → permitted actions matrix (mirrors packages/auth/src/index.ts checkPermission).
// readOnly tools require "read"; destructive (delete) tools require "delete";
// schema-modifying tools require "schema"; everything else requires "update".
const ROLE_ACTIONS: Record<string, Set<string>> = {
  reader: new Set(["read"]),
  operator: new Set(["read", "create", "update"]),
  developer: new Set(["read", "create", "update", "delete", "schema"]),
  auditor: new Set(["read"]),
};

// Tools that modify schema/system state — require "schema" (developer only).
const SCHEMA_TOOLS = new Set(["crm_define_field"]);

// Tools that any authenticated agent can call regardless of role.
// `crm_request_approval` is a request, not an action — readers can request; only
// developers can approve via the API route.
const ALWAYS_ALLOWED = new Set(["crm_request_approval"]);

function actionForTool(name: string, annotations: any): string {
  if (ALWAYS_ALLOWED.has(name)) return "read";
  if (SCHEMA_TOOLS.has(name)) return "schema";
  if (annotations?.readOnly) return "read";
  if (annotations?.destructive) return "delete";
  // Default: any non-readOnly, non-destructive tool counts as create/update.
  return "update";
}

export function createMCPServer(deps: ToolDeps) {
  const server = new McpServer({
    name: "headless-crm",
    version: "0.1.0",
  });

  const tools = defineTools(deps);
  const role = deps.ctx.role ?? "reader";
  const allowedActions = ROLE_ACTIONS[role] ?? new Set();

  // Register all tools
  for (const [name, tool] of Object.entries(tools)) {
    const requiredAction = actionForTool(name, (tool as any).annotations);
    const inputShape = tool.inputSchema.shape as any;
    server.tool(
      name,
      tool.description,
      inputShape,
      async (args: any) => {
        // Role gate: reject before executing if the caller lacks permission.
        if (!allowedActions.has(requiredAction)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Forbidden: role '${role}' cannot perform '${requiredAction}' (tool: ${name}). Required role: ${requiredAction === "delete" || requiredAction === "schema" ? "developer" : requiredAction === "update" || requiredAction === "create" ? "operator" : "reader"}+`,
                  code: "FORBIDDEN",
                }),
              },
            ],
            isError: true,
          };
        }
        try {
          const result = await tool.execute(args);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: error.message }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register resources
  server.resource("schema", "crm://schema", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await tools.crm_schema.execute({})),
      },
    ],
  }));

  return server;
}

export { defineTools } from "./tools/index";
export type { ToolDeps } from "./tools/index";
