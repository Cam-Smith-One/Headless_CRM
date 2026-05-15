#!/usr/bin/env node
const apiURL = process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const adminKey = process.env.ADMIN_API_KEY;
const concurrencyCount = Number.parseInt(process.env.CONCURRENCY_COUNT ?? "6", 10);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function provisionAgent(tenantId, name, role, type = "supervised") {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${apiURL}/api/agents/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
      body: JSON.stringify({ tenantId, name, role, type }),
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (res.ok) return body;
    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? body?.retryAfter ?? "2", 10);
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
      continue;
    }
    throw new Error(`POST /api/agents/provision failed: ${res.status} ${JSON.stringify(body)}`);
  }

  throw new Error("POST /api/agents/provision failed after retries");
}

async function provisionAgentsSequentially(tenantId, count, prefix, role) {
  const agents = [];
  for (let index = 0; index < count; index++) {
    agents.push(await provisionAgent(tenantId, `${prefix} ${index + 1}`, role));
  }
  return agents;
}

const tenantId = `tenant_smoke_${Date.now()}`;
const email = `smoke-${Date.now()}@example.com`;

const ready = await request("/api/ready");
console.log(`ready: ${ready.body.status} (${ready.body.database})`);

const operator = await provisionAgent(tenantId, "Self-host Smoke Operator", "operator");
const token = operator.token;
console.log(`operator: ${operator.agent.id}`);

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

const reader = await provisionAgent(tenantId, "Self-host Smoke Reader", "reader");
const readerRecord = await request(`/api/contacts/${contact.body.id}`, {
  headers: { Authorization: `Bearer ${reader.token}` },
});
if (readerRecord.body.id !== contact.body.id) {
  throw new Error("reader could not fetch contact");
}
const readerDenied = await fetch(`${apiURL}/api/contacts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${reader.token}` },
  body: JSON.stringify({ firstName: "Nope", lastName: "Reader" }),
});
if (readerDenied.status !== 403) {
  throw new Error(`reader create should be denied; got ${readerDenied.status}`);
}
console.log("reader: read ok, write denied");

const auditor = await provisionAgent(tenantId, "Self-host Smoke Auditor", "auditor");
const auditEvents = await request("/api/events?limit=10", {
  headers: { Authorization: `Bearer ${auditor.token}` },
});
if (!Array.isArray(auditEvents.body) || auditEvents.body.length === 0) {
  throw new Error("auditor should see audit events");
}
const auditLogs = await request(`/api/agents/${operator.agent.id}/logs?limit=10`, {
  headers: { Authorization: `Bearer ${auditor.token}` },
});
if (!Array.isArray(auditLogs.body)) {
  throw new Error("auditor should see agent logs");
}
const auditorDenied = await fetch(`${apiURL}/api/contacts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${auditor.token}` },
  body: JSON.stringify({ firstName: "Nope", lastName: "Auditor" }),
});
if (auditorDenied.status !== 403) {
  throw new Error(`auditor create should be denied; got ${auditorDenied.status}`);
}
console.log(`auditor: ${auditEvents.body.length} events visible, write denied`);

const concurrencyAgents = await provisionAgentsSequentially(
  tenantId,
  Math.max(2, Math.min(concurrencyCount, 8)),
  "Self-host Burst",
  "operator",
);

const concurrentCreates = await Promise.all(
  concurrencyAgents.map((agent, index) =>
    request("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.token}` },
      body: JSON.stringify({
        firstName: "Burst",
        lastName: `Agent ${index + 1}`,
        email: `burst-${Date.now()}-${index}@example.com`,
        title: "Concurrent Operator",
      }),
    })
  )
);

const concurrentUpdates = await Promise.all(
  concurrentCreates.map((created, index) =>
    request(`/api/contacts/${created.body.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${concurrencyAgents[index].token}` },
      body: JSON.stringify({ title: `Concurrent Operator ${index + 1}` }),
    })
  )
);

if (concurrentUpdates.some((update) => !String(update.body.title).startsWith("Concurrent Operator"))) {
  throw new Error("concurrent updates did not persist");
}
console.log(`concurrency: ${concurrentCreates.length} concurrent creates and updates passed`);

console.log("self-host smoke passed");
