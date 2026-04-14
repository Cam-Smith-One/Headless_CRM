import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import * as schema from "./schema/index";

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  // Tenant
  const tenantId = "tenant_demo";
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: "Demo Workspace",
    slug: "demo",
  }).onConflictDoNothing();

  // Agents
  const agentIds = {
    enrichment: `agent_${nanoid(8)}`,
    pipeline: `agent_${nanoid(8)}`,
    logger: `agent_${nanoid(8)}`,
    scorer: `agent_${nanoid(8)}`,
  };

  for (const [key, id] of Object.entries(agentIds)) {
    const names: Record<string, string> = {
      enrichment: "Lead Enrichment v2",
      pipeline: "Pipeline Monitor",
      logger: "Activity Logger",
      scorer: "Health Scorer",
    };
    const types: Record<string, "autonomous" | "reactive" | "supervised" | "scheduled"> = {
      enrichment: "autonomous",
      pipeline: "reactive",
      logger: "supervised",
      scorer: "scheduled",
    };
    await db.insert(schema.agents).values({
      id,
      tenantId,
      name: names[key],
      type: types[key],
      role: key === "scorer" ? "reader" : "operator",
    }).onConflictDoNothing();
  }

  // Pipeline — Sales pipeline for One Zero Ten
  const pipelineId = `pipe_${nanoid(8)}`;
  await db.insert(schema.pipelines).values({
    id: pipelineId,
    tenantId,
    name: "Sales Pipeline",
    stages: [
      { name: "Lead", order: 1, probability: 5 },
      { name: "Qualified", order: 2, probability: 15 },
      { name: "Discovery", order: 3, probability: 25 },
      { name: "Proposal", order: 4, probability: 50 },
      { name: "Negotiation", order: 5, probability: 70 },
      { name: "Won", order: 6, probability: 100 },
      { name: "Onboarding", order: 7, probability: 100 },
      { name: "Active", order: 8, probability: 100 },
      { name: "Churned", order: 9, probability: 0 },
    ],
  }).onConflictDoNothing();

  // Pipeline auto-advance triggers for email engagement
  // email.opened → Lead → Qualified
  // email.clicked → Qualified → Discovery (stronger signal)
  // email.replied → any stage → Discovery (reply = high intent)
  const triggerDefs = [
    { triggerEvent: "email.opened", fromStage: "Lead", toStage: "Qualified" },
    { triggerEvent: "email.clicked", fromStage: "Lead", toStage: "Qualified" },
    { triggerEvent: "email.clicked", fromStage: "Qualified", toStage: "Discovery" },
    { triggerEvent: "email.replied", fromStage: null, toStage: "Discovery" },
  ];
  for (const td of triggerDefs) {
    await db.insert(schema.pipelineTriggers).values({
      id: `trig_${nanoid(8)}`,
      tenantId,
      pipelineId,
      triggerEvent: td.triggerEvent,
      fromStage: td.fromStage,
      toStage: td.toStage,
      active: true,
    }).onConflictDoNothing();
  }

  // Companies
  const companies = [
    { name: "TechFlow Inc", domain: "techflow.io", industry: "SaaS", size: "51-200" },
    { name: "Nexus AI", domain: "nexus.ai", industry: "AI/ML", size: "11-50" },
    { name: "CloudBase Ltd", domain: "cloudbase.com", industry: "Infrastructure", size: "201-500" },
    { name: "DataSynth", domain: "datasynth.io", industry: "Data", size: "11-50" },
    { name: "ScaleOps", domain: "scaleops.com", industry: "DevOps", size: "51-200" },
  ];

  const companyIds: string[] = [];
  for (const company of companies) {
    const id = `co_${nanoid(8)}`;
    companyIds.push(id);
    await db.insert(schema.companies).values({
      id,
      tenantId,
      ...company,
      createdByAgentId: agentIds.enrichment,
      updatedByAgentId: agentIds.enrichment,
    }).onConflictDoNothing();
  }

  // Contacts
  const contactData = [
    { firstName: "Sarah", lastName: "Chen", email: "sarah@techflow.io", title: "VP Engineering", companyIdx: 0 },
    { firstName: "Marcus", lastName: "Johnson", email: "marcus@nexus.ai", title: "CTO", companyIdx: 1 },
    { firstName: "Elena", lastName: "Volkov", email: "elena@cloudbase.com", title: "Head of Product", companyIdx: 2 },
    { firstName: "James", lastName: "Park", email: "james@datasynth.io", title: "CEO", companyIdx: 3 },
    { firstName: "Priya", lastName: "Sharma", email: "priya@scaleops.com", title: "Director of Sales", companyIdx: 4 },
  ];

  for (const contact of contactData) {
    const { companyIdx, ...data } = contact;
    await db.insert(schema.contacts).values({
      id: `c_${nanoid(8)}`,
      tenantId,
      ...data,
      companyId: companyIds[companyIdx],
      createdByAgentId: agentIds.enrichment,
      updatedByAgentId: agentIds.enrichment,
    }).onConflictDoNothing();
  }

  // Deals
  const dealData = [
    { name: "TechFlow Platform License", value: "48000", stage: "Lead", companyIdx: 0 },
    { name: "Nexus AI Integration", value: "24000", stage: "Lead", companyIdx: 1 },
    { name: "CloudBase Migration", value: "240000", stage: "Proposal", companyIdx: 2 },
    { name: "DataSynth Enterprise", value: "120000", stage: "Qualified", companyIdx: 3 },
    { name: "ScaleOps Annual", value: "36000", stage: "Discovery", companyIdx: 4 },
  ];

  for (const deal of dealData) {
    const { companyIdx, ...data } = deal;
    await db.insert(schema.deals).values({
      id: `d_${nanoid(8)}`,
      tenantId,
      ...data,
      pipelineId,
      companyId: companyIds[companyIdx],
      ownerAgentId: agentIds.pipeline,
      createdByAgentId: agentIds.pipeline,
      updatedByAgentId: agentIds.pipeline,
    }).onConflictDoNothing();
  }

  // Cases
  const caseData = [
    { title: "Billing discrepancy on invoice #1042", status: "open", priority: "high", category: "billing", companyIdx: 0 },
    { title: "API integration returning 500 errors", status: "in_progress", priority: "urgent", category: "technical", companyIdx: 1 },
    { title: "Request for bulk export feature", status: "waiting", priority: "medium", category: "general", companyIdx: 2 },
    { title: "SSO setup assistance needed", status: "open", priority: "low", category: "technical", companyIdx: 3 },
  ];

  for (const caseItem of caseData) {
    const { companyIdx, ...data } = caseItem;
    await db.insert(schema.cases).values({
      id: `case_${nanoid(8)}`,
      tenantId,
      ...data,
      companyId: companyIds[companyIdx],
      assignedAgentId: agentIds.logger,
      createdByAgentId: agentIds.logger,
      updatedByAgentId: agentIds.logger,
    }).onConflictDoNothing();
  }

  console.log("Seed complete!");
  console.log(`  Tenant: ${tenantId}`);
  console.log(`  Agents: ${Object.keys(agentIds).length}`);
  console.log(`  Companies: ${companies.length}`);
  console.log(`  Contacts: ${contactData.length}`);
  console.log(`  Deals: ${dealData.length}`);
  console.log(`  Cases: ${caseData.length}`);

  await client.end();
}

seed().catch(console.error);
