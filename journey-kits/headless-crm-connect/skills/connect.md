# Skill: Connect to Headless CRM

## Purpose

Wire this agent to a Headless CRM instance so every subsequent task can read and write CRM data through the 29 available MCP tools.

## When to Use

Run this skill once when setting up a new agent workspace that needs CRM access, or when the CRM endpoint or API key has changed.

## Steps

1. Check whether `HEADLESS_CRM_TOKEN` and `HEADLESS_CRM_API_URL` are already set in the environment.
2. If missing, ask the user for the CRM URL (default: `http://localhost:3001`) and their agent API key.
3. Write the MCP server entry to the agent's MCP configuration file.
4. Test the connection by calling `crm_query` on `contacts` with `limit: 1`.
5. Report success with the number of contacts found, or surface the error clearly.

## Outputs

- MCP server entry written to config
- Connection verified
- Agent can now use all `crm_*` tools

## Notes

- Never store the API key in plaintext in a committed file — always reference `$HEADLESS_CRM_TOKEN`
- If the agent only needs read access, provision with role `reader` rather than `operator`
