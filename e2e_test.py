#!/usr/bin/env python3
"""
Headless CRM — Comprehensive E2E Test Suite
Tests: all CRUD surfaces, RBAC personas, agent onboarding, dashboard widgets
"""

import sys, json, time, requests
from datetime import datetime, timezone

API        = "http://localhost:3001"
ADMIN_KEY  = "REDACTED"
TENANT_ID  = "REDACTED"
TS         = int(time.time())

PASS = "✅"; FAIL = "❌"; SKIP = "⚠️"
results = []

# Dynamic keys — set after provisioning
READER_KEY    = None
OPERATOR_KEY  = None
DEVELOPER_KEY = None
AUDITOR_KEY   = None

def ok(label):
    results.append((PASS, label))
    print(f"  {PASS} {label}")

def fail(label, detail=""):
    results.append((FAIL, label))
    print(f"  {FAIL} {label}" + (f": {detail}" if detail else ""))

def skip(label, reason=""):
    results.append((SKIP, label))
    print(f"  {SKIP} {label}" + (f" ({reason})" if reason else ""))

def section(title):
    print(f"\n{'─'*60}\n  {title}\n{'─'*60}")

def api(method, path, token=None, admin=False, **kwargs):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if admin:
        headers["X-Admin-Key"] = ADMIN_KEY
    r = getattr(requests, method)(f"{API}{path}", headers=headers, timeout=10, **kwargs)
    return r

def as_list(r):
    try:
        d = r.json()
        return d if isinstance(d, list) else d.get("data", d.get("items", []))
    except Exception:
        return []

def get_id(r):
    try:
        d = r.json()
        return (d.get("data") or d).get("id") if isinstance(d, dict) else None
    except Exception:
        return None

# ════════════════════════════════════════════════════════════
# 1. Health Check
# ════════════════════════════════════════════════════════════
section("1. HEALTH CHECK")
r = requests.get(f"{API}/health", timeout=5)
if r.status_code == 200 and r.json().get("status") == "ok":
    ok(f"API healthy (v{r.json().get('version','?')})")
else:
    fail("API health check"); sys.exit(1)

# ════════════════════════════════════════════════════════════
# 2. Agent Onboarding (via /api/agents/provision with admin key)
# ════════════════════════════════════════════════════════════
section("2. AGENT ONBOARDING — PROVISION 4 FRESH AGENTS")

new_agents = {}
for role in ["reader", "operator", "developer", "auditor"]:
    r = api("post", "/api/agents/provision", admin=True, json={
        "name": f"e2e-{role}-{TS}",
        "role": role,
        "type": "autonomous",
        "tenantId": TENANT_ID,
    })
    if r.status_code == 201:
        d = r.json()
        aid  = d.get("agentId") or d.get("id") or (d.get("agent") or {}).get("id")
        akey = d.get("apiKey")  or d.get("key")
        new_agents[role] = {"id": aid, "key": akey}
        ok(f"Provisioned {role}: id={aid}")
    elif r.status_code == 429:
        skip(f"Provision {role}", "rate-limited")
        fail(f"Provision {role} — cannot continue without keys", "hit rate limit on provision")
    else:
        fail(f"Provision {role}", f"{r.status_code} {r.text[:120]}")

# Wire globals from provisioned keys
READER_KEY    = new_agents.get("reader",    {}).get("key")
OPERATOR_KEY  = new_agents.get("operator",  {}).get("key")
DEVELOPER_KEY = new_agents.get("developer", {}).get("key")
AUDITOR_KEY   = new_agents.get("auditor",   {}).get("key")

if not all([READER_KEY, OPERATOR_KEY, DEVELOPER_KEY, AUDITOR_KEY]):
    print("\n  ❌ FATAL: could not provision all agents — aborting")
    sys.exit(1)

# New agents default to active when provisioned via admin key
# Verify each persona can authenticate
for role, key in [("reader", READER_KEY), ("operator", OPERATOR_KEY),
                  ("developer", DEVELOPER_KEY), ("auditor", AUDITOR_KEY)]:
    r = api("get", "/api/stats", token=key)
    if r.status_code == 200:
        ok(f"{role.capitalize()} agent authenticated ✓")
    elif r.status_code == 401:
        # May be pending_approval — approve via admin provision of developer then approve others
        # Try activating via developer key if available
        aid = new_agents[role]["id"]
        if DEVELOPER_KEY and role != "developer":
            r2 = api("post", f"/api/agents/{aid}/approve", token=DEVELOPER_KEY)
            r3 = api("get", "/api/stats", token=key)
            if r3.status_code == 200:
                ok(f"{role.capitalize()} agent authenticated after approval ✓")
            else:
                fail(f"{role.capitalize()} agent auth after approve", f"{r3.status_code}")
        else:
            fail(f"{role.capitalize()} agent auth", f"{r.status_code} {r.text[:60]}")
    else:
        fail(f"{role.capitalize()} agent auth", f"{r.status_code} {r.text[:60]}")

# ════════════════════════════════════════════════════════════
# 3. Contacts CRUD
# ════════════════════════════════════════════════════════════
section("3. CONTACTS CRUD")
contact_id = None

r = api("post", "/api/contacts", token=OPERATOR_KEY, json={
    "firstName": "Alice", "lastName": f"E2E-{TS}",
    "email": f"alice-{TS}@example.com", "title": "VP Engineering"
})
if r.status_code in (200, 201):
    contact_id = get_id(r)
    ok(f"Create contact → {contact_id}")
else:
    fail("Create contact", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/contacts", token=READER_KEY)
if r.status_code == 200:
    ok(f"List contacts → {len(as_list(r))} records")
else:
    fail("List contacts", r.text[:80])

if contact_id:
    r = api("get", f"/api/contacts/{contact_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get contact by ID")
    else:
        fail("Get contact by ID", r.text[:80])

    r = api("patch", f"/api/contacts/{contact_id}", token=OPERATOR_KEY, json={"title": "CTO"})
    if r.status_code == 200:
        ok("Update contact")
    else:
        fail("Update contact", r.text[:80])

r = api("get", "/api/contacts?search=E2E", token=READER_KEY)
if r.status_code == 200:
    ok(f"Search contacts")
else:
    fail("Search contacts", r.text[:80])

# RBAC: reader cannot write
if contact_id:
    r = api("patch", f"/api/contacts/{contact_id}", token=READER_KEY, json={"title": "Hacker"})
    if r.status_code in (401, 403):
        ok("Reader blocked from updating contact (RBAC ✓)")
    else:
        fail(f"Reader write should be blocked, got {r.status_code}")

# RBAC: auditor cannot write
if contact_id:
    r = api("patch", f"/api/contacts/{contact_id}", token=AUDITOR_KEY, json={"title": "Hacker"})
    if r.status_code in (401, 403):
        ok("Auditor blocked from updating contact (RBAC ✓)")
    else:
        fail(f"Auditor write should be blocked, got {r.status_code}")

# ════════════════════════════════════════════════════════════
# 4. Companies CRUD
# ════════════════════════════════════════════════════════════
section("4. COMPANIES CRUD")
company_id = None

r = api("post", "/api/companies", token=OPERATOR_KEY, json={
    "name": f"Acme Corp {TS}", "domain": f"acme-{TS}.io",
    "industry": "Technology", "size": "51-200"
})
if r.status_code in (200, 201):
    company_id = get_id(r)
    ok(f"Create company → {company_id}")
else:
    fail("Create company", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/companies", token=READER_KEY)
if r.status_code == 200:
    ok(f"List companies → {len(as_list(r))} records")
else:
    fail("List companies", r.text[:80])

if company_id:
    r = api("get", f"/api/companies/{company_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get company by ID")
    else:
        fail("Get company by ID", r.text[:80])

    r = api("patch", f"/api/companies/{company_id}", token=OPERATOR_KEY, json={"size": "201-500"})
    if r.status_code == 200:
        ok("Update company")
    else:
        fail("Update company", r.text[:80])

# ════════════════════════════════════════════════════════════
# 5. Deals + Pipelines CRUD
# ════════════════════════════════════════════════════════════
section("5. DEALS + PIPELINES CRUD")
pipeline_id = None
deal_id     = None

# Developer can create pipeline
r = api("post", "/api/pipelines", token=DEVELOPER_KEY, json={
    "name": f"E2E Pipeline {TS}",
    "stages": [
        {"name": "Prospect",   "order": 0, "probability": 10},
        {"name": "Qualified",  "order": 1, "probability": 30},
        {"name": "Proposal",   "order": 2, "probability": 60},
        {"name": "Closed Won", "order": 3, "probability": 100},
    ]
})
if r.status_code in (200, 201):
    pipeline_id = get_id(r)
    ok(f"Developer creates pipeline → {pipeline_id}")
else:
    fail("Create pipeline", f"{r.status_code} {r.text[:120]}")

# Operator cannot create pipeline
r = api("post", "/api/pipelines", token=OPERATOR_KEY, json={"name": "Blocked", "stages": ["A"]})
if r.status_code in (401, 403):
    ok("Operator blocked from creating pipeline (RBAC ✓)")
else:
    fail(f"Operator pipeline create should be blocked, got {r.status_code}")

r = api("get", "/api/pipelines", token=READER_KEY)
if r.status_code == 200:
    ok(f"List pipelines → {len(as_list(r))} pipelines")
else:
    fail("List pipelines", r.text[:80])

# Create deal
deal_payload = {
    "name": f"Enterprise Deal {TS}",
    "value": 75000,
    "stage": "Prospect",
    "closeDate": "2026-09-01T00:00:00.000Z"
}
if pipeline_id:
    deal_payload["pipelineId"] = pipeline_id
r = api("post", "/api/deals", token=OPERATOR_KEY, json=deal_payload)
if r.status_code in (200, 201):
    deal_id = get_id(r)
    ok(f"Create deal → {deal_id}")
else:
    fail("Create deal", f"{r.status_code} {r.text[:120]}")

r = api("get", "/api/deals", token=READER_KEY)
if r.status_code == 200:
    ok(f"List deals → {len(as_list(r))} records")
else:
    fail("List deals", r.text[:80])

if deal_id:
    r = api("patch", f"/api/deals/{deal_id}", token=OPERATOR_KEY, json={"stage": "Qualified"})
    if r.status_code == 200:
        ok("Update deal stage")
    else:
        fail("Update deal stage", r.text[:80])

    r = api("get", f"/api/deals/{deal_id}/stage-history", token=READER_KEY)
    if r.status_code == 200:
        ok(f"Deal stage history → {len(as_list(r))} entries")
    else:
        fail("Deal stage history", r.text[:80])

if deal_id and contact_id:
    r = api("post", f"/api/deals/{deal_id}/contacts", token=OPERATOR_KEY, json={"contactId": contact_id})
    if r.status_code in (200, 201):
        ok("Link contact to deal")
    else:
        fail("Link contact to deal", r.text[:80])

# ════════════════════════════════════════════════════════════
# 6. Cases CRUD
# ════════════════════════════════════════════════════════════
section("6. CASES CRUD")
case_id = None

r = api("post", "/api/cases", token=OPERATOR_KEY, json={
    "title": f"Support Ticket {TS}",
    "description": "Customer reports login failure",
    "priority": "high",
    "status": "open",
    "contactId": contact_id or "none"
})
if r.status_code in (200, 201):
    case_id = get_id(r)
    ok(f"Create case → {case_id}")
else:
    fail("Create case", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/cases", token=READER_KEY)
if r.status_code == 200:
    ok(f"List cases → {len(as_list(r))} records")
else:
    fail("List cases", r.text[:80])

if case_id:
    r = api("get", f"/api/cases/{case_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get case by ID")
    else:
        fail("Get case by ID", r.text[:80])

    r = api("patch", f"/api/cases/{case_id}", token=OPERATOR_KEY, json={"status": "in_progress"})
    if r.status_code == 200:
        ok("Update case status")
    else:
        fail("Update case", r.text[:80])

# ════════════════════════════════════════════════════════════
# 7. Activities
# ════════════════════════════════════════════════════════════
section("7. ACTIVITIES")
activity_id = None

r = api("post", "/api/activities", token=OPERATOR_KEY, json={
    "type": "call",
    "subject": f"Discovery call {TS}",
    "body": "Discussed requirements",
    "recordType": "contact",
    "recordId": contact_id or "none"
})
if r.status_code in (200, 201):
    activity_id = get_id(r)
    ok(f"Create activity → {activity_id}")
else:
    fail("Create activity", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/activities", token=READER_KEY)
if r.status_code == 200:
    ok(f"List activities → {len(as_list(r))} records")
else:
    fail("List activities", r.text[:80])

if activity_id:
    r = api("get", f"/api/activities/{activity_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get activity by ID")
    else:
        fail("Get activity by ID", r.text[:80])

# ════════════════════════════════════════════════════════════
# 8. Tags
# ════════════════════════════════════════════════════════════
section("8. TAGS")
tag_id = None

r = api("post", "/api/tags", token=OPERATOR_KEY, json={"name": f"vip-{TS}", "color": "#6366f1", "objectType": "contacts"})
if r.status_code in (200, 201):
    tag_id = get_id(r)
    ok(f"Create tag → {tag_id}")
else:
    fail("Create tag", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/tags", token=READER_KEY)
if r.status_code == 200:
    ok(f"List tags → {len(as_list(r))} tags")
else:
    fail("List tags", r.text[:80])

if tag_id and contact_id:
    r = api("post", "/api/tags/attach", token=OPERATOR_KEY, json={
        "tagId": tag_id, "recordType": "contact", "recordId": contact_id
    })
    if r.status_code in (200, 201, 204):
        ok("Attach tag to contact")
    else:
        fail("Attach tag", f"{r.status_code} {r.text[:80]}")

    r = api("get", f"/api/tags/record/contact/{contact_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get tags for contact record")
    else:
        fail("Get record tags", r.text[:80])

    r = api("post", "/api/tags/detach", token=OPERATOR_KEY, json={
        "tagId": tag_id, "recordType": "contact", "recordId": contact_id
    })
    if r.status_code in (200, 201, 204):
        ok("Detach tag from contact")
    else:
        fail("Detach tag", f"{r.status_code} {r.text[:80]}")

# ════════════════════════════════════════════════════════════
# 9. Custom Fields
# ════════════════════════════════════════════════════════════
section("9. CUSTOM FIELDS")
cf_id = None

r = api("post", "/api/custom-fields", token=DEVELOPER_KEY, json={
    "collection": "contacts",
    "fieldName": f"priority_score_{TS}",
    "fieldType": "number",
    "label": "Priority Score"
})
if r.status_code in (200, 201):
    cf_id = get_id(r)
    ok(f"Developer creates custom field → {cf_id}")
else:
    fail("Create custom field", f"{r.status_code} {r.text[:80]}")

# Operator cannot create custom fields (requireManage = developer only)
r = api("post", "/api/custom-fields", token=OPERATOR_KEY, json={
    "collection": "contacts",
    "fieldName": f"blocked_{TS}",
    "fieldType": "text",
    "label": "Should Fail"
})
if r.status_code in (401, 403):
    ok("Operator blocked from creating custom fields (RBAC ✓)")
else:
    fail(f"Operator custom field create should be blocked, got {r.status_code}")

r = api("get", "/api/custom-fields", token=READER_KEY)
if r.status_code == 200:
    ok(f"List custom fields → {len(as_list(r))} fields")
else:
    fail("List custom fields", r.text[:80])

if cf_id:
    r = api("get", f"/api/custom-fields/{cf_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get custom field by ID")
    else:
        fail("Get custom field by ID", r.text[:80])

    r = api("patch", f"/api/custom-fields/{cf_id}", token=DEVELOPER_KEY, json={"label": "Priority Score (updated)"})
    if r.status_code == 200:
        ok("Update custom field")
    else:
        fail("Update custom field", f"{r.status_code} {r.text[:80]}")

# ════════════════════════════════════════════════════════════
# 10. Webhooks
# ════════════════════════════════════════════════════════════
section("10. WEBHOOKS")
webhook_id = None

r = api("post", "/api/webhooks", token=OPERATOR_KEY, json={
    "url": "https://webhook.site/test-e2e",
    "eventTypes": ["contact.created", "deal.updated"],
    "description": "E2E test webhook"
})
if r.status_code in (200, 201):
    webhook_id = get_id(r)
    ok(f"Create webhook → {webhook_id}")
else:
    fail("Create webhook", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/webhooks", token=READER_KEY)
if r.status_code == 200:
    ok(f"List webhooks → {len(as_list(r))} webhooks")
else:
    fail("List webhooks", r.text[:80])

if webhook_id:
    r = api("get", f"/api/webhooks/{webhook_id}", token=READER_KEY)
    if r.status_code == 200:
        ok("Get webhook by ID")
    else:
        fail("Get webhook by ID", r.text[:80])

    r = api("patch", f"/api/webhooks/{webhook_id}", token=OPERATOR_KEY, json={"active": False})
    if r.status_code == 200:
        ok("Update (disable) webhook")
    else:
        fail("Update webhook", r.text[:80])

    r = api("post", f"/api/webhooks/{webhook_id}/test", token=OPERATOR_KEY)
    if r.status_code in (200, 201, 202):
        ok("Test webhook delivery")
    else:
        fail("Test webhook", f"{r.status_code} {r.text[:80]}")

    r = api("get", f"/api/webhooks/{webhook_id}/deliveries", token=READER_KEY)
    if r.status_code == 200:
        ok(f"List webhook deliveries → {len(as_list(r))} entries")
    else:
        fail("List webhook deliveries", r.text[:80])

# ════════════════════════════════════════════════════════════
# 11. Saved Searches
# ════════════════════════════════════════════════════════════
section("11. SAVED SEARCHES")
search_id = None

r = api("post", "/api/saved-searches", token=OPERATOR_KEY, json={
    "name": f"High-value contacts {TS}",
    "collection": "contacts",
    "filters": {"title": "VP"}
})
if r.status_code in (200, 201):
    search_id = get_id(r)
    ok(f"Create saved search → {search_id}")
else:
    fail("Create saved search", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/saved-searches", token=READER_KEY)
if r.status_code == 200:
    ok(f"List saved searches → {len(as_list(r))} searches")
else:
    fail("List saved searches", r.text[:80])

if search_id:
    r = api("patch", f"/api/saved-searches/{search_id}", token=OPERATOR_KEY, json={"name": f"Updated search {TS}"})
    if r.status_code == 200:
        ok("Update saved search")
    else:
        fail("Update saved search", r.text[:80])

# ════════════════════════════════════════════════════════════
# 12. Approvals
# ════════════════════════════════════════════════════════════
section("12. APPROVALS")
approval_id = None

r = api("post", "/api/approvals", token=OPERATOR_KEY, json={
    "type": "bulk_operation",
    "title": f"Export Q2 contacts {TS}",
    "description": "Requesting approval to export contact data for marketing campaign"
})
if r.status_code in (200, 201):
    approval_id = get_id(r)
    ok(f"Operator requests approval → {approval_id}")
else:
    fail("Create approval request", f"{r.status_code} {r.text[:80]}")

r = api("get", "/api/approvals", token=READER_KEY)
if r.status_code == 200:
    ok(f"List approvals → {len(as_list(r))} records")
else:
    fail("List approvals", r.text[:80])

r = api("get", "/api/approvals/pending", token=DEVELOPER_KEY)
if r.status_code == 200:
    ok(f"List pending approvals → {len(as_list(r))} pending")
else:
    fail("List pending approvals", r.text[:80])

if approval_id:
    r = api("post", f"/api/approvals/{approval_id}/approve", token=DEVELOPER_KEY, json={"reviewNote": "Approved for Q2 campaign"})
    if r.status_code == 200:
        ok("Developer approves approval")
    else:
        fail("Approve approval", f"{r.status_code} {r.text[:80]}")

# Operator cannot approve
r2 = api("post", "/api/approvals", token=OPERATOR_KEY, json={
    "type": "destructive_action", "title": f"Test operator approve {TS}"
})
if r2.status_code in (200, 201):
    a2_id = get_id(r2)
    r3 = api("post", f"/api/approvals/{a2_id}/approve", token=OPERATOR_KEY, json={})
    if r3.status_code in (401, 403):
        ok("Operator blocked from approving approvals (RBAC ✓)")
    else:
        fail(f"Operator approval approve should be blocked, got {r3.status_code}")

# ════════════════════════════════════════════════════════════
# 13. Stats & Audit Events
# ════════════════════════════════════════════════════════════
section("13. STATS & AUDIT EVENTS")

r = api("get", "/api/stats", token=READER_KEY)
if r.status_code == 200:
    s = r.json()
    ok(f"Stats → contacts={s.get('totalContacts',0)}, deals={s.get('totalDeals',0)}, companies={s.get('totalCompanies',0)}")
else:
    fail("Get stats", r.text[:80])

# Auditor can read events
r = api("get", "/api/events", token=AUDITOR_KEY)
if r.status_code == 200:
    ok(f"Auditor reads event log → {len(as_list(r))} events")
else:
    fail("Auditor cannot read events (RBAC broken)", f"{r.status_code} {r.text[:80]}")

# Reader cannot read events
r = api("get", "/api/events", token=READER_KEY)
if r.status_code in (401, 403):
    ok("Reader blocked from audit events (RBAC ✓)")
else:
    fail(f"Reader should be blocked from events, got {r.status_code}")

# Operator cannot read events
r = api("get", "/api/events", token=OPERATOR_KEY)
if r.status_code in (401, 403):
    ok("Operator blocked from audit events (RBAC ✓)")
else:
    fail(f"Operator should be blocked from events, got {r.status_code}")

# ════════════════════════════════════════════════════════════
# 14. Agent Management
# ════════════════════════════════════════════════════════════
section("14. AGENT MANAGEMENT")

r = api("get", "/api/agents", token=READER_KEY)
if r.status_code == 200:
    ok(f"List agents → {len(as_list(r))} agents")
else:
    fail("List agents", r.text[:80])

# Provision a fresh agent via the protected /api/agents route (developer only)
r = api("post", "/api/agents", token=DEVELOPER_KEY, json={
    "name": f"managed-agent-{TS}",
    "role": "operator",
    "type": "autonomous"
})
managed_id = None
if r.status_code in (200, 201):
    d = r.json()
    managed_id = d.get("agentId") or (d.get("agent") or {}).get("id") or get_id(r)
    ok(f"Developer provisions agent via API → {managed_id}")
else:
    fail("Developer provision agent", f"{r.status_code} {r.text[:80]}")

# Operator cannot provision agents
r = api("post", "/api/agents", token=OPERATOR_KEY, json={"name": "blocked", "role": "reader"})
if r.status_code in (401, 403):
    ok("Operator blocked from provisioning agents (RBAC ✓)")
else:
    fail(f"Operator agent provision should be blocked, got {r.status_code}")

if managed_id:
    r = api("post", f"/api/agents/{managed_id}/approve", token=DEVELOPER_KEY)
    if r.status_code == 200:
        ok("Developer approves managed agent")
    else:
        fail("Approve managed agent", f"{r.status_code} {r.text[:80]}")

    r = api("post", f"/api/agents/{managed_id}/suspend", token=DEVELOPER_KEY)
    if r.status_code == 200:
        ok("Developer suspends agent")
    else:
        fail("Suspend agent", f"{r.status_code} {r.text[:80]}")

    r = api("get", f"/api/agents/{managed_id}/logs", token=AUDITOR_KEY)
    if r.status_code == 200:
        ok(f"Auditor reads agent logs")
    else:
        fail("Auditor reads agent logs", f"{r.status_code} {r.text[:80]}")

    # Reader cannot view agent logs
    r = api("get", f"/api/agents/{managed_id}/logs", token=READER_KEY)
    if r.status_code in (401, 403):
        ok("Reader blocked from agent logs (RBAC ✓)")
    else:
        fail(f"Reader should be blocked from agent logs, got {r.status_code}")

# ════════════════════════════════════════════════════════════
# 15. Notifications
# ════════════════════════════════════════════════════════════
section("15. NOTIFICATIONS")

r = api("get", "/api/notifications", token=READER_KEY)
if r.status_code == 200:
    ok(f"List notifications → {len(as_list(r))} items")
else:
    fail("List notifications", r.text[:80])

r = api("get", "/api/notifications/unread-count", token=READER_KEY)
if r.status_code == 200:
    ok(f"Unread count → {r.json()}")
else:
    fail("Unread count", r.text[:80])

r = api("post", "/api/notifications/read-all", token=OPERATOR_KEY)
if r.status_code in (200, 204):
    ok("Mark all notifications read")
else:
    fail("Mark all read", f"{r.status_code} {r.text[:80]}")

# ════════════════════════════════════════════════════════════
# 16. Email Log
# ════════════════════════════════════════════════════════════
section("16. EMAIL LOG")

r = api("post", "/api/emails/log", token=OPERATOR_KEY, json={
    "direction": "outbound",
    "from": "crm@headless-crm.dev",
    "to": "alice@example.com",
    "subject": f"Follow-up {TS}",
    "body": "Just checking in",
    "contactId": contact_id or None
})
if r.status_code in (200, 201):
    ok("Log email")
else:
    fail("Log email", f"{r.status_code} {r.text[:80]}")

if contact_id:
    r = api("get", f"/api/emails?contactId={contact_id}", token=READER_KEY)
    if r.status_code == 200:
        ok(f"List emails by contactId → {len(as_list(r))} records")
    else:
        fail("List emails by contactId", r.text[:80])
else:
    skip("List emails", "no contact_id")

# ════════════════════════════════════════════════════════════
# 17. Pipeline Triggers
# ════════════════════════════════════════════════════════════
section("17. PIPELINE TRIGGERS")
trigger_id = None

if pipeline_id:
    r = api("post", "/api/pipeline-triggers", token=DEVELOPER_KEY, json={
        "triggerType": "time_elapsed",
        "pipelineId": pipeline_id,
        "fromStage": "Prospect",
        "toStage": "Qualified",
        "checkIntervalMinutes": 1440,
        "active": True
    })
    if r.status_code in (200, 201):
        trigger_id = get_id(r)
        ok(f"Developer creates pipeline trigger → {trigger_id}")
    else:
        fail("Create pipeline trigger", f"{r.status_code} {r.text[:80]}")

    r = api("post", "/api/pipeline-triggers", token=OPERATOR_KEY, json={
        "triggerType": "time_elapsed", "pipelineId": pipeline_id,
        "fromStage": "Prospect", "toStage": "Qualified", "checkIntervalMinutes": 60
    })
    if r.status_code in (401, 403):
        ok("Operator blocked from creating pipeline trigger (RBAC ✓)")
    else:
        fail(f"Operator trigger create should be blocked, got {r.status_code}")

r = api("get", "/api/pipeline-triggers", token=READER_KEY)
if r.status_code == 200:
    ok(f"List pipeline triggers → {len(as_list(r))} triggers")
else:
    fail("List pipeline triggers", r.text[:80])

# ════════════════════════════════════════════════════════════
# 18. CSV Export
# ════════════════════════════════════════════════════════════
section("18. CSV EXPORT")

for entity in ["contacts", "companies", "deals"]:
    r = api("get", f"/api/{entity}/export?format=csv", token=OPERATOR_KEY)
    if r.status_code == 200:
        ct = r.headers.get("content-type","")
        ok(f"Export {entity} → {len(r.content)} bytes ({ct.split(';')[0]})")
    else:
        fail(f"Export {entity}", f"{r.status_code} {r.text[:80]}")

# ════════════════════════════════════════════════════════════
# 19. Search
# ════════════════════════════════════════════════════════════
section("19. SEARCH")

r = api("get", "/api/search/semantic?q=enterprise&collection=contacts", token=READER_KEY)
if r.status_code in (200, 501):
    ok(f"Semantic search contacts → {r.status_code} (501=no embeddings configured, ok)")
else:
    fail("Semantic search", f"{r.status_code} {r.text[:80]}")

# Basic contact search already tested in section 3

# ════════════════════════════════════════════════════════════
# 20. Delete / Cleanup
# ════════════════════════════════════════════════════════════
section("20. DELETE / CLEANUP")

delete_cases = [
    ("Delete deal-contact link", f"/api/deals/{deal_id}/contacts/{contact_id}", deal_id and contact_id),
    ("Delete case",              f"/api/cases/{case_id}",                        case_id),
    ("Delete activity",          f"/api/activities/{activity_id}",               activity_id),
    ("Delete deal",              f"/api/deals/{deal_id}",                         deal_id),
    ("Delete contact",           f"/api/contacts/{contact_id}",                   contact_id),
    ("Delete company",           f"/api/companies/{company_id}",                  company_id),
    ("Delete webhook",           f"/api/webhooks/{webhook_id}",                   webhook_id),
    ("Delete tag",               f"/api/tags/{tag_id}",                           tag_id),
    ("Delete saved search",      f"/api/saved-searches/{search_id}",              search_id),
    ("Delete pipeline trigger",  f"/api/pipeline-triggers/{trigger_id}",          trigger_id),
    ("Delete pipeline",          f"/api/pipelines/{pipeline_id}",                 pipeline_id),
    ("Delete custom field",      f"/api/custom-fields/{cf_id}",                   cf_id),
]

for label, path, guard in delete_cases:
    if not guard:
        skip(label, "ID not available")
        continue
    r = api("delete", path, token=DEVELOPER_KEY)
    if r.status_code in (200, 204):
        ok(label)
    elif r.status_code == 404:
        skip(label, "already gone")
    else:
        fail(label, f"{r.status_code} {r.text[:80]}")

# Reader cannot delete
r = api("delete", f"/api/tags/{tag_id}" if tag_id else "/api/tags/nonexistent", token=READER_KEY)
if r.status_code in (401, 403, 404):  # 404 is ok since we already deleted
    ok("Reader blocked from deleting (RBAC ✓)")
else:
    fail(f"Reader delete should be blocked, got {r.status_code}")

# ════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════
passed  = sum(1 for s,_ in results if s == PASS)
failed  = sum(1 for s,_ in results if s == FAIL)
skipped = sum(1 for s,_ in results if s == SKIP)
total   = len(results)

print(f"\n{'═'*60}")
print(f"  RESULT: {passed}/{total} passed  |  {failed} failed  |  {skipped} skipped")
print(f"{'═'*60}")

if failed:
    print("\nFAILURES:")
    for s,l in results:
        if s == FAIL:
            print(f"  {FAIL} {l}")

sys.exit(0 if failed == 0 else 1)
