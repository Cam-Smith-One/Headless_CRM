import { expect, test } from "@playwright/test";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001";
const adminKey = process.env.ADMIN_API_KEY;

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
  const provision = await request.post(`${apiURL}/api/agents/provision`, {
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey!,
    },
    data: {
      tenantId,
      name: "E2E Operator Agent",
      role: "operator",
      type: "supervised",
    },
  });
  expect(provision.status()).toBe(201);
  const { token } = await provision.json();
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

test("first-run setup can create the owner when database is empty", async ({ page, request }) => {
  const status = await request.get("/api/auth/setup-status");
  const setup = await status.json();
  test.skip(setup.hasUsers, "setup flow only runs on an empty database");

  const suffix = Date.now();
  await page.goto("/setup");
  await page.getByPlaceholder("Jane Smith").fill("E2E Owner");
  await page.getByPlaceholder("jane@company.com").fill(`owner-${suffix}@example.com`);
  await page.locator("input[type='password']").fill("TestPassword123!");
  await page.getByPlaceholder("Acme Corp").fill("E2E Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("E2E Owner")).toBeVisible();
});

test("human persona can log in and edit a contact when credentials are provided", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required for human CRUD E2E");

  const suffix = Date.now();
  await page.goto("/login");
  await page.getByPlaceholder("jane@company.com").fill(email!);
  await page.locator("input[type='password']").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

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

  await page.getByText("Human Tester").click();
  await page.getByRole("button", { name: "Edit" }).click();
  const visibleInputs = page.locator("main input:visible");
  await visibleInputs.nth(4).fill("Senior Revenue Ops");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Senior Revenue Ops")).toBeVisible();
});
