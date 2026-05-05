#!/usr/bin/env node
const apiURL = process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const adminKey = process.env.ADMIN_API_KEY;

if (!adminKey) {
  console.error("ADMIN_API_KEY is required. Load .env or pass ADMIN_API_KEY=...");
  process.exit(1);
}

async function request(path, options = {}) {
  const res = await fetch(`${apiURL}${path}`, options);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { res, body };
}

const tenantId = `tenant_smoke_${Date.now()}`;
const email = `smoke-${Date.now()}@example.com`;

const ready = await request("/api/ready");
console.log(`ready: ${ready.body.status} (${ready.body.database})`);

const provision = await request("/api/agents/provision", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
  body: JSON.stringify({ tenantId, name: "Self-host Smoke Agent", role: "operator", type: "supervised" }),
});
const token = provision.body.token;
console.log(`agent: ${provision.body.agent.id}`);

const contact = await request("/api/contacts", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ firstName: "Smoke", lastName: "Agent", email, title: "Operator" }),
});
console.log(`contact: ${contact.body.id}`);

const updated = await request(`/api/contacts/${contact.body.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ title: "Senior Operator" }),
});
console.log(`updated: ${updated.body.title}`);

const denied = await fetch(`${apiURL}/api/contacts/${contact.body.id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
if (denied.status !== 403) {
  throw new Error(`operator delete should be denied; got ${denied.status}`);
}
console.log("delete denied: 403");

const stats = await request("/api/stats", {
  headers: { Authorization: `Bearer ${token}` },
});
console.log(`stats contacts: ${stats.body.contacts?.total ?? "ok"}`);
console.log("self-host smoke passed");
