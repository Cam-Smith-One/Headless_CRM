import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";
const adminKey = process.env.ADMIN_API_KEY;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function provisionAgent(
  request: APIRequestContext,
  tenantId: string,
  name: string,
  role: "reader" | "operator" | "developer" | "auditor",
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request.post(`${apiURL}/api/agents/provision`, {
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey!,
      },
      data: {
        tenantId,
        name,
        role,
        type: "supervised",
      },
    });

    if (response.status() === 201) {
      return response.json();
    }

    if (response.status() === 429 && attempt < 3) {
      const retryAfter = Number.parseInt(response.headers()["retry-after"] ?? "2", 10);
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
      continue;
    }

    expect(response.status()).toBe(201);
  }

  throw new Error("Failed to provision agent after retries");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  if (!page.url().includes("/login")) return;
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function ensureOwnerAccount(request: APIRequestContext, page: Page, email: string, password: string) {
  const status = await request.get("/api/auth/setup-status");
  const setup = await status.json();
  if (setup.hasUsers) return;

  await page.goto("/setup");
  await page.getByPlaceholder("Jane Smith").fill("E2E Owner");
  await page.getByPlaceholder("jane@company.com").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByPlaceholder("Acme Corp").fill("E2E Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("public login page does not render protected app shell", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Contacts" })).toHaveCount(0);
});

test("MCP discovery is public and advertises bearer auth", async ({ request }) => {
  const res = await request.get("/.well-known/mcp.json");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.name).toBe("headless-crm");
  expect(body.transport.authentication.type).toBe("bearer");
  expect(body.capabilities.tools).toBe(true);
});

test("agent persona can provision, create, update, and is denied delete", async ({ request }) => {
  test.skip(!adminKey, "ADMIN_API_KEY is required for agent E2E smoke");

  const tenantId = `tenant_e2e_${Date.now()}`;
  const { token } = await provisionAgent(request, tenantId, "E2E Operator Agent", "operator");
  expect(token).toBeTruthy();

  const contact = await request.post(`${apiURL}/api/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      firstName: "E2E",
      lastName: "Agent",
      email: `agent-${Date.now()}@example.com`,
      title: "Operator",
    },
  });
  expect(contact.status()).toBe(201);
  const created = await contact.json();

  const update = await request.patch(`${apiURL}/api/contacts/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Senior Operator" },
  });
  expect(update.status()).toBe(200);
  await expect(update).toBeOK();
  expect((await update.json()).title).toBe("Senior Operator");

  const deniedDelete = await request.delete(`${apiURL}/api/contacts/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(deniedDelete.status()).toBe(403);

  const stats = await request.get(`${apiURL}/api/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(stats.status()).toBe(200);
});

test("reader and auditor personas enforce the right API boundaries", async ({ request }) => {
  test.skip(!adminKey, "ADMIN_API_KEY is required for agent persona E2E");

  const tenantId = `tenant_roles_${Date.now()}`;
  const operator = await provisionAgent(request, tenantId, "Role Operator", "operator");

  const created = await request.post(`${apiURL}/api/contacts`, {
    headers: { Authorization: `Bearer ${operator.token}` },
    data: {
      firstName: "Role",
      lastName: "Seed",
      email: `roles-${Date.now()}@example.com`,
      title: "Seed Contact",
    },
  });
  expect(created.status()).toBe(201);
  const contact = await created.json();

  const reader = await provisionAgent(request, tenantId, "Role Reader", "reader");

  const readerGet = await request.get(`${apiURL}/api/contacts/${contact.id}`, {
    headers: { Authorization: `Bearer ${reader.token}` },
  });
  expect(readerGet.status()).toBe(200);

  const readerDenied = await request.post(`${apiURL}/api/contacts`, {
    headers: { Authorization: `Bearer ${reader.token}` },
    data: { firstName: "Nope", lastName: "Reader" },
  });
  expect(readerDenied.status()).toBe(403);

  const auditor = await provisionAgent(request, tenantId, "Role Auditor", "auditor");

  const auditorEvents = await request.get(`${apiURL}/api/events?limit=10`, {
    headers: { Authorization: `Bearer ${auditor.token}` },
  });
  expect(auditorEvents.status()).toBe(200);
  const auditorEventsBody = await auditorEvents.json();
  expect(Array.isArray(auditorEventsBody)).toBeTruthy();
  expect(auditorEventsBody.length).toBeGreaterThan(0);

  const auditorLogs = await request.get(`${apiURL}/api/agents/${operator.agent.id}/logs?limit=10`, {
    headers: { Authorization: `Bearer ${auditor.token}` },
  });
  expect(auditorLogs.status()).toBe(200);
  expect(Array.isArray(await auditorLogs.json())).toBeTruthy();

  const auditorDenied = await request.post(`${apiURL}/api/contacts`, {
    headers: { Authorization: `Bearer ${auditor.token}` },
    data: { firstName: "Nope", lastName: "Auditor" },
  });
  expect(auditorDenied.status()).toBe(403);
});

test("multiple operator agents can write concurrently", async ({ request }) => {
  test.skip(!adminKey, "ADMIN_API_KEY is required for concurrency E2E");

  const tenantId = `tenant_concurrency_${Date.now()}`;
  const operators = [];
  for (let index = 0; index < 4; index++) {
    operators.push(
      await provisionAgent(request, tenantId, `Burst Operator ${index + 1}`, "operator")
    );
  }
  const provisioned = operators;

  const creates = await Promise.all(
    provisioned.map((agent, index) =>
      request.post(`${apiURL}/api/contacts`, {
        headers: { Authorization: `Bearer ${agent.token}` },
        data: {
          firstName: "Burst",
          lastName: `Operator ${index + 1}`,
          email: `burst-${Date.now()}-${index}@example.com`,
          title: "Concurrent Operator",
        },
      })
    )
  );

  for (const response of creates) {
    expect(response.status()).toBe(201);
  }
  const contacts = await Promise.all(creates.map((response) => response.json()));

  const updates = await Promise.all(
    contacts.map((contact, index) =>
      request.patch(`${apiURL}/api/contacts/${contact.id}`, {
        headers: { Authorization: `Bearer ${provisioned[index].token}` },
        data: {
          title: `Concurrent Operator ${index + 1}`,
        },
      })
    )
  );

  for (const response of updates) {
    expect(response.status()).toBe(200);
    expect((await response.json()).title).toContain("Concurrent Operator");
  }
});

test("first-run setup can create the owner when database is empty", async ({ page, request }) => {
  const status = await request.get("/api/auth/setup-status");
  const setup = await status.json();
  test.skip(setup.hasUsers, "setup flow only runs on an empty database");

  const suffix = Date.now();
  const email = process.env.E2E_EMAIL ?? `owner-${suffix}@example.com`;
  const password = process.env.E2E_PASSWORD ?? "TestPassword123!";
  await page.goto("/setup");
  await page.getByPlaceholder("Jane Smith").fill("E2E Owner");
  await page.getByPlaceholder("jane@company.com").fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByPlaceholder("Acme Corp").fill("E2E Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("E2E Owner")).toBeVisible();
});

test("human persona can log in and edit a contact when credentials are provided", async ({ page, request }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required for human CRUD E2E");

  const suffix = Date.now();
  await ensureOwnerAccount(request, page, email!, password!);
  await login(page, email!, password!);

  await page.goto("/contacts");
  await page.getByRole("button", { name: "+ New Contact" }).click();
  const inputs = page.locator("main input");
  await inputs.nth(1).fill("Human");
  await inputs.nth(2).fill("Tester");
  await inputs.nth(3).fill(`human-${suffix}@example.com`);
  await inputs.nth(4).fill("+61 400 000 000");
  await inputs.nth(5).fill("Revenue Ops");
  await page.getByRole("button", { name: "Create Contact" }).click();
  await expect(page.getByText(`human-${suffix}@example.com`)).toBeVisible();

  await page.getByText("Human Tester").first().click();
  await page.getByRole("button", { name: "Edit" }).click();
  const visibleInputs = page.locator("main input:visible");
  await visibleInputs.nth(4).fill("Senior Revenue Ops");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("main").getByText("Senior Revenue Ops").first()).toBeVisible();

  await page.locator("input[type='file']").setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from playwright"),
  });
  await expect(page.locator("main").getByText("brief.txt").first()).toBeVisible();
});

test("owner can invite a teammate, teammate can join, and owner can promote them to admin", async ({ page, browser, request }) => {
  const ownerEmail = process.env.E2E_EMAIL;
  const ownerPassword = process.env.E2E_PASSWORD;
  test.skip(!ownerEmail || !ownerPassword, "E2E_EMAIL and E2E_PASSWORD are required for team E2E");

  const suffix = Date.now();
  const teammateEmail = `teammate-${suffix}@example.com`;
  const teammatePassword = "TeamPassword123!";
  const adminInviteeEmail = `admin-invite-${suffix}@example.com`;

  await ensureOwnerAccount(request, page, ownerEmail!, ownerPassword!);
  await login(page, ownerEmail!, ownerPassword!);
  await page.goto("/settings/team");
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByPlaceholder("colleague@company.com").fill(teammateEmail);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Invite created. Share this link with your team member:")).toBeVisible();
  const inviteUrl = ((await page.locator(".fixed code").textContent()) ?? "").trim();
  expect(inviteUrl).toContain("/signup?token=");
  const inviteBaseUrl = new URL(inviteUrl).origin;
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(teammateEmail)).toBeVisible();

  const teammateContext = await browser.newContext();
  const teammatePage = await teammateContext.newPage();
  await teammatePage.goto(inviteUrl);
  await expect(teammatePage.getByRole("heading", { name: "Accept invite" })).toBeVisible();
  await teammatePage.getByPlaceholder("Jane Smith").fill("Teammate Admin");
  await teammatePage.locator("input[type='password']").fill(teammatePassword);
  await teammatePage.getByRole("button", { name: "Create account" }).click();
  await expect(teammatePage).toHaveURL(/\/$/);

  await teammatePage.goto(`${inviteBaseUrl}/settings/team`);
  await expect(teammatePage).toHaveURL(/\/settings\/team$/);
  await expect(teammatePage.getByRole("button", { name: "Invite member" })).toHaveCount(0);

  await page.goto("/settings/team");
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.locator("main").getByText(teammateEmail)).toBeVisible();
  await page.getByLabel(`Role for ${teammateEmail}`).selectOption("admin");
  await expect(page.getByLabel(`Role for ${teammateEmail}`)).toHaveValue("admin");

  await teammatePage.goto(`${inviteBaseUrl}/settings/team`);
  await expect(teammatePage.getByRole("button", { name: "Invite member" })).toBeVisible();
  await teammatePage.getByRole("button", { name: "Invite member" }).click();
  await teammatePage.getByPlaceholder("colleague@company.com").fill(adminInviteeEmail);
  await teammatePage.getByRole("button", { name: "Send invite" }).click();
  await expect(teammatePage.getByText("Invite created. Share this link with your team member:")).toBeVisible();
  await teammatePage.getByRole("button", { name: "Done" }).click();
  await expect(teammatePage.locator("main").getByText(adminInviteeEmail)).toBeVisible();

  await teammateContext.close();
});
