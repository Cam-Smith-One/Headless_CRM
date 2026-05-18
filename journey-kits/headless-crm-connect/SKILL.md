# Headless CRM — Connect

Connect this agent to a Headless CRM instance and verify the MCP tools are available.

## Instructions

When the user asks you to connect to Headless CRM, or when you detect that `crm_*` tools are unavailable but CRM operations are needed:

1. **Check environment** — look for `HEADLESS_CRM_TOKEN` and `HEADLESS_CRM_API_URL`. If both are set, skip to step 4.

2. **Gather credentials** — ask the user:
   - CRM API URL (default: `http://localhost:3001`)
   - Agent API key (format: `hcrm_sk_...`)
   
   Do not proceed without both.

3. **Write MCP config** — add the headless-crm server entry to the agent's MCP configuration:
   ```json
   {
     "mcpServers": {
       "headless-crm": {
         "type": "http",
         "url": "<HEADLESS_CRM_API_URL>/mcp",
         "headers": {
           "Authorization": "Bearer <HEADLESS_CRM_TOKEN>"
         }
       }
     }
   }
   ```
   For Claude Code this goes in `~/.claude/mcp.json`. Append — do not overwrite existing servers.

4. **Verify connection** — call `crm_query` with `{ "collection": "contacts", "limit": 1 }`. 
   - On success: report "Connected to Headless CRM. Found N contacts."
   - On 401: the API key is invalid — ask the user to re-provision via `POST /api/agents/provision`.
   - On connection refused: the CRM server isn't running — instruct the user to run `npm run dev` in the Headless CRM directory.

5. **Summarise available tools** — list the tool categories now available (contacts, companies, deals, cases, activities, pipelines, approvals, memory).

## Security

- Never log or display the full API key.
- Never commit the API key to version control — reference `$HEADLESS_CRM_TOKEN` in config files.
- If the user's role is `reader`, remind them that write operations will be rejected.
