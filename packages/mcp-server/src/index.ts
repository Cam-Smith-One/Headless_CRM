import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineTools, type ToolDeps } from "./tools/index";

export function createMCPServer(deps: ToolDeps) {
  const server = new McpServer({
    name: "headless-crm",
    version: "0.1.0",
  });

  const tools = defineTools(deps);

  // Register all tools
  for (const [name, tool] of Object.entries(tools)) {
    server.tool(
      name,
      tool.description,
      tool.inputSchema.shape,
      async (args: any) => {
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
