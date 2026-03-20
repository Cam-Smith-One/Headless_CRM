/**
 * OpenAPI 3.1 specification for the Headless CRM API.
 *
 * Generated from the Hono routes in app.ts and the Drizzle schemas
 * in packages/db/src/schema/.
 */

export function getOpenAPISpec() {
  const spec: Record<string, any> = {
    openapi: "3.1.0",
    info: {
      title: "Headless CRM API",
      version: "0.1.0",
      description:
        "Agent-first headless CRM with MCP-native interface for AI agents. Provides full CRUD for contacts, companies, deals, cases, webhooks, custom fields, activities, events, agents and dashboard stats.",
      license: { name: "MIT" },
    },
    servers: [{ url: "/", description: "Current deployment" }],

    // ── Security ──────────────────────────────────────────────────
    security: [{ BearerAuth: [] }],

    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "JWT or agent API key obtained from POST /api/agents/provision.",
        },
        AdminKey: {
          type: "apiKey",
          in: "header",
          name: "X-Admin-Key",
          description:
            "Server-side ADMIN_API_KEY used exclusively for the /api/agents/provision bootstrap endpoint.",
        },
      },

      schemas: {
        // ── Shared ────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
          required: ["error"],
        },

        // ── Contact ───────────────────────────────────────────────
        Contact: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            firstName: { type: ["string", "null"] },
            lastName: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            companyId: { type: ["string", "null"] },
            stateCode: { type: "string" },
            statusCode: { type: ["string", "null"] },
            customFields: { type: "object", additionalProperties: true },
            createdByAgentId: { type: ["string", "null"] },
            updatedByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ContactCreate: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            title: { type: "string" },
            companyId: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },
        ContactUpdate: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            title: { type: "string" },
            companyId: { type: "string" },
            stateCode: { type: "string" },
            statusCode: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },

        // ── Company ───────────────────────────────────────────────
        Company: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            name: { type: "string" },
            domain: { type: ["string", "null"] },
            industry: { type: ["string", "null"] },
            size: { type: ["string", "null"] },
            parentCompanyId: { type: ["string", "null"] },
            stateCode: { type: "string" },
            statusCode: { type: ["string", "null"] },
            customFields: { type: "object", additionalProperties: true },
            createdByAgentId: { type: ["string", "null"] },
            updatedByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CompanyCreate: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            domain: { type: "string" },
            industry: { type: "string" },
            size: { type: "string" },
            parentCompanyId: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },
        CompanyUpdate: {
          type: "object",
          properties: {
            name: { type: "string" },
            domain: { type: "string" },
            industry: { type: "string" },
            size: { type: "string" },
            parentCompanyId: { type: "string" },
            stateCode: { type: "string" },
            statusCode: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },

        // ── Deal ──────────────────────────────────────────────────
        Deal: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            name: { type: "string" },
            value: { type: ["string", "null"] },
            currency: { type: ["string", "null"] },
            stage: { type: "string" },
            pipelineId: { type: "string" },
            companyId: { type: ["string", "null"] },
            closeDate: { type: ["string", "null"], format: "date-time" },
            ownerAgentId: { type: ["string", "null"] },
            stateCode: { type: "string" },
            statusCode: { type: ["string", "null"] },
            customFields: { type: "object", additionalProperties: true },
            createdByAgentId: { type: ["string", "null"] },
            updatedByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DealCreate: {
          type: "object",
          required: ["name", "stage", "pipelineId"],
          properties: {
            name: { type: "string" },
            value: { type: "string" },
            currency: { type: "string" },
            stage: { type: "string" },
            pipelineId: { type: "string" },
            companyId: { type: "string" },
            closeDate: { type: "string", format: "date-time" },
            ownerAgentId: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },
        DealUpdate: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "string" },
            currency: { type: "string" },
            stage: { type: "string" },
            pipelineId: { type: "string" },
            companyId: { type: "string" },
            closeDate: { type: "string", format: "date-time" },
            ownerAgentId: { type: "string" },
            stateCode: { type: "string" },
            statusCode: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },

        // ── Case ──────────────────────────────────────────────────
        Case: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            title: { type: "string" },
            description: { type: ["string", "null"] },
            status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            category: { type: ["string", "null"] },
            contactId: { type: ["string", "null"] },
            companyId: { type: ["string", "null"] },
            dealId: { type: ["string", "null"] },
            assignedAgentId: { type: ["string", "null"] },
            resolvedAt: { type: ["string", "null"], format: "date-time" },
            customFields: { type: "object", additionalProperties: true },
            createdByAgentId: { type: ["string", "null"] },
            updatedByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CaseCreate: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            category: { type: "string" },
            contactId: { type: "string" },
            companyId: { type: "string" },
            dealId: { type: "string" },
            assignedAgentId: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },
        CaseUpdate: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            category: { type: "string" },
            contactId: { type: "string" },
            companyId: { type: "string" },
            dealId: { type: "string" },
            assignedAgentId: { type: "string" },
            customFields: { type: "object", additionalProperties: true },
          },
        },

        // ── Agent ─────────────────────────────────────────────────
        Agent: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["autonomous", "supervised", "scheduled", "reactive"] },
            status: { type: "string", enum: ["active", "suspended", "decommissioned"] },
            role: { type: "string", enum: ["reader", "operator", "developer", "auditor"] },
            ownerUserId: { type: ["string", "null"] },
            policyId: { type: ["string", "null"] },
            metadata: { type: "object", additionalProperties: true },
            lastActiveAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AgentProvision: {
          type: "object",
          required: ["name", "tenantId"],
          properties: {
            name: { type: "string" },
            tenantId: { type: "string" },
            type: { type: "string", enum: ["autonomous", "supervised", "scheduled", "reactive"] },
            role: { type: "string", enum: ["reader", "operator", "developer", "auditor"] },
          },
        },
        AgentProvisionResult: {
          type: "object",
          properties: {
            agent: { $ref: "#/components/schemas/Agent" },
            apiKey: { type: "string", description: "Plaintext API key — shown only once." },
          },
        },

        // ── Webhook ───────────────────────────────────────────────
        Webhook: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            url: { type: "string", format: "uri" },
            secret: { type: "string" },
            eventTypes: { type: "array", items: { type: "string" } },
            active: { type: "boolean" },
            description: { type: ["string", "null"] },
            createdByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        WebhookCreate: {
          type: "object",
          required: ["url", "eventTypes"],
          properties: {
            url: { type: "string", format: "uri" },
            eventTypes: { type: "array", items: { type: "string" } },
            description: { type: "string" },
          },
        },
        WebhookUpdate: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            eventTypes: { type: "array", items: { type: "string" } },
            active: { type: "boolean" },
            description: { type: "string" },
          },
        },
        WebhookDelivery: {
          type: "object",
          properties: {
            id: { type: "integer" },
            webhookId: { type: "string" },
            eventId: { type: ["integer", "null"] },
            status: { type: "string" },
            statusCode: { type: ["integer", "null"] },
            responseBody: { type: ["string", "null"] },
            attempts: { type: "integer" },
            maxAttempts: { type: "integer" },
            nextRetryAt: { type: ["string", "null"], format: "date-time" },
            lastAttemptAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Custom Field ──────────────────────────────────────────
        CustomFieldDefinition: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            collection: { type: "string" },
            fieldName: { type: "string" },
            fieldType: { type: "string", enum: ["text", "number", "boolean", "date", "select", "multiselect", "url", "email"] },
            required: { type: "boolean" },
            options: { type: ["array", "null"], items: { type: "string" } },
            defaultValue: {},
            description: { type: ["string", "null"] },
            displayOrder: { type: "integer" },
            active: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CustomFieldCreate: {
          type: "object",
          required: ["collection", "fieldName", "fieldType"],
          properties: {
            collection: { type: "string" },
            fieldName: { type: "string" },
            fieldType: { type: "string" },
            required: { type: "boolean" },
            options: { type: "array", items: { type: "string" } },
            defaultValue: {},
            description: { type: "string" },
            displayOrder: { type: "integer" },
          },
        },
        CustomFieldUpdate: {
          type: "object",
          properties: {
            fieldName: { type: "string" },
            fieldType: { type: "string" },
            required: { type: "boolean" },
            options: { type: "array", items: { type: "string" } },
            defaultValue: {},
            description: { type: "string" },
            displayOrder: { type: "integer" },
            active: { type: "boolean" },
          },
        },

        // ── Activity ──────────────────────────────────────────────
        Activity: {
          type: "object",
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            type: { type: "string", enum: ["call", "email", "meeting", "note", "task", "agent_action"] },
            subject: { type: ["string", "null"] },
            body: { type: ["string", "null"] },
            direction: { type: ["string", "null"] },
            contactId: { type: ["string", "null"] },
            companyId: { type: ["string", "null"] },
            dealId: { type: ["string", "null"] },
            metadata: { type: "object", additionalProperties: true },
            occurredAt: { type: "string", format: "date-time" },
            createdByAgentId: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ActivityCreate: {
          type: "object",
          required: ["type"],
          properties: {
            type: { type: "string", enum: ["call", "email", "meeting", "note", "task", "agent_action"] },
            subject: { type: "string" },
            body: { type: "string" },
            direction: { type: "string" },
            contactId: { type: "string" },
            companyId: { type: "string" },
            dealId: { type: "string" },
            metadata: { type: "object", additionalProperties: true },
            occurredAt: { type: "string", format: "date-time" },
          },
        },

        // ── Event (audit) ─────────────────────────────────────────
        CrmEvent: {
          type: "object",
          properties: {
            id: { type: "integer" },
            tenantId: { type: "string" },
            eventType: { type: "string" },
            recordType: { type: "string" },
            recordId: { type: "string" },
            agentId: { type: ["string", "null"] },
            userId: { type: ["string", "null"] },
            changes: { type: "object", additionalProperties: true },
            metadata: { type: "object", additionalProperties: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Stats ─────────────────────────────────────────────────
        Stats: {
          type: "object",
          properties: {
            contacts: {
              type: "object",
              properties: { total: { type: "integer" }, thisWeek: { type: "integer" } },
            },
            companies: {
              type: "object",
              properties: { total: { type: "integer" }, thisWeek: { type: "integer" } },
            },
            deals: {
              type: "object",
              properties: {
                total: { type: "integer" },
                active: { type: "integer" },
                pipelineValue: { type: "number" },
              },
            },
            cases: {
              type: "object",
              properties: { total: { type: "integer" }, open: { type: "integer" } },
            },
            agents: {
              type: "object",
              properties: { total: { type: "integer" }, active: { type: "integer" } },
            },
            events: {
              type: "object",
              properties: { total: { type: "integer" }, today: { type: "integer" } },
            },
          },
        },

        // ── MCP Discovery ─────────────────────────────────────────
        McpDiscovery: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            description: { type: "string" },
            transport: {
              type: "object",
              properties: {
                type: { type: "string" },
                url: { type: "string" },
                authentication: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
            },
            capabilities: {
              type: "object",
              properties: {
                tools: { type: "boolean" },
                resources: { type: "boolean" },
              },
            },
          },
        },
      },

      parameters: {
        LimitParam: { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        OffsetParam: { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        SearchParam: { name: "search", in: "query", schema: { type: "string" } },
        IdParam: { name: "id", in: "path", required: true, schema: { type: "string" } },
      },
    },

    tags: [
      { name: "Contacts", description: "Contact records" },
      { name: "Companies", description: "Company records" },
      { name: "Deals", description: "Deal / opportunity records" },
      { name: "Cases", description: "Support case records" },
      { name: "Activities", description: "Activity log" },
      { name: "Events", description: "Audit event trail" },
      { name: "Agents", description: "AI agent management" },
      { name: "Webhooks", description: "Webhook subscriptions and deliveries" },
      { name: "Custom Fields", description: "Custom field definitions" },
      { name: "Stats", description: "Dashboard statistics" },
      { name: "MCP", description: "Model Context Protocol endpoint" },
      { name: "System", description: "Health checks, setup, and docs" },
    ],

    paths: {
      // ── Health ────────────────────────────────────────────────
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          security: [],
          responses: {
            "200": {
              description: "Service is healthy",
              content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, version: { type: "string" } } } } },
            },
          },
        },
      },

      // ── Setup ─────────────────────────────────────────────────
      "/api/setup/status": {
        get: {
          tags: ["System"],
          summary: "Check setup status",
          security: [],
          responses: {
            "200": {
              description: "Setup configuration status",
              content: { "application/json": { schema: { type: "object", properties: { configured: { type: "boolean" }, agentCount: { type: "integer" }, adminKeySet: { type: "boolean" } } } } },
            },
          },
        },
      },

      // ── Agent provisioning (admin key) ────────────────────────
      "/api/agents/provision": {
        post: {
          tags: ["Agents"],
          summary: "Provision a new agent (admin bootstrap)",
          description: "Creates a new agent and returns its API key. Requires the ADMIN_API_KEY header instead of Bearer auth.",
          security: [{ AdminKey: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AgentProvision" } } } },
          responses: {
            "201": { description: "Agent created", content: { "application/json": { schema: { $ref: "#/components/schemas/AgentProvisionResult" } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Invalid admin key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "501": { description: "Admin provisioning not configured", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ── Contacts ──────────────────────────────────────────────
      ...crudPaths("contacts", "Contact", "Contacts", {
        listParams: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { $ref: "#/components/parameters/SearchParam" },
        ],
      }),

      // ── Companies ─────────────────────────────────────────────
      ...crudPaths("companies", "Company", "Companies", {
        listParams: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { $ref: "#/components/parameters/SearchParam" },
        ],
      }),

      // ── Deals ─────────────────────────────────────────────────
      ...crudPaths("deals", "Deal", "Deals", {
        listParams: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "pipelineId", in: "query", schema: { type: "string" } },
        ],
      }),

      // ── Cases ─────────────────────────────────────────────────
      ...crudPaths("cases", "Case", "Cases", {
        listParams: [
          { $ref: "#/components/parameters/LimitParam" },
          { $ref: "#/components/parameters/OffsetParam" },
          { $ref: "#/components/parameters/SearchParam" },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
        ],
      }),

      // ── Activities ────────────────────────────────────────────
      "/api/activities": {
        post: {
          tags: ["Activities"],
          summary: "Log an activity",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ActivityCreate" } } } },
          responses: {
            "201": { description: "Activity created", content: { "application/json": { schema: { $ref: "#/components/schemas/Activity" } } } },
          },
        },
      },

      // ── Events ────────────────────────────────────────────────
      "/api/events": {
        get: {
          tags: ["Events"],
          summary: "List audit events",
          parameters: [
            { $ref: "#/components/parameters/LimitParam" },
            { $ref: "#/components/parameters/OffsetParam" },
          ],
          responses: {
            "200": { description: "Event list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/CrmEvent" } } } } },
          },
        },
      },

      // ── Agents (authenticated) ────────────────────────────────
      "/api/agents": {
        get: {
          tags: ["Agents"],
          summary: "List agents for the current tenant",
          responses: {
            "200": { description: "Agent list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Agent" } } } } },
          },
        },
        post: {
          tags: ["Agents"],
          summary: "Create a new agent",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, role: { type: "string" } }, required: ["name"] } } } },
          responses: {
            "201": { description: "Agent created", content: { "application/json": { schema: { $ref: "#/components/schemas/AgentProvisionResult" } } } },
          },
        },
      },
      "/api/agents/{id}/suspend": {
        post: {
          tags: ["Agents"],
          summary: "Suspend an agent",
          parameters: [{ $ref: "#/components/parameters/IdParam" }],
          responses: { "200": { description: "Agent suspended", content: { "application/json": { schema: { $ref: "#/components/schemas/Agent" } } } } },
        },
      },
      "/api/agents/{id}/approve": {
        post: {
          tags: ["Agents"],
          summary: "Approve / activate an agent",
          parameters: [{ $ref: "#/components/parameters/IdParam" }],
          responses: { "200": { description: "Agent activated", content: { "application/json": { schema: { $ref: "#/components/schemas/Agent" } } } } },
        },
      },
      "/api/agents/{id}/reject": {
        post: {
          tags: ["Agents"],
          summary: "Reject / suspend an agent",
          parameters: [{ $ref: "#/components/parameters/IdParam" }],
          responses: { "200": { description: "Agent rejected", content: { "application/json": { schema: { $ref: "#/components/schemas/Agent" } } } } },
        },
      },

      // ── Stats ─────────────────────────────────────────────────
      "/api/stats": {
        get: {
          tags: ["Stats"],
          summary: "Dashboard statistics",
          responses: { "200": { description: "Aggregated stats", content: { "application/json": { schema: { $ref: "#/components/schemas/Stats" } } } } },
        },
      },

      // ── Webhooks ──────────────────────────────────────────────
      ...crudPaths("webhooks", "Webhook", "Webhooks", { listParams: [] }),
      "/api/webhooks/{id}/deliveries": {
        get: {
          tags: ["Webhooks"],
          summary: "List deliveries for a webhook",
          parameters: [
            { $ref: "#/components/parameters/IdParam" },
            { name: "status", in: "query", schema: { type: "string" } },
            { $ref: "#/components/parameters/LimitParam" },
            { $ref: "#/components/parameters/OffsetParam" },
          ],
          responses: { "200": { description: "Delivery list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } } } } } },
        },
      },
      "/api/webhooks/{id}/test": {
        post: {
          tags: ["Webhooks"],
          summary: "Send a test webhook delivery",
          parameters: [{ $ref: "#/components/parameters/IdParam" }],
          responses: {
            "200": { description: "Delivery result", content: { "application/json": { schema: { type: "object" } } } },
            "404": { description: "Webhook not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ── Custom Fields ─────────────────────────────────────────
      ...crudPaths("custom-fields", "CustomFieldDefinition", "Custom Fields", {
        listParams: [{ name: "collection", in: "query", schema: { type: "string" } }],
        createSchema: "CustomFieldCreate",
        updateSchema: "CustomFieldUpdate",
      }),

      // ── MCP ───────────────────────────────────────────────────
      "/api/mcp": {
        post: {
          tags: ["MCP"],
          summary: "MCP Streamable HTTP transport",
          description: "Model Context Protocol endpoint. Initialises a new MCP session on first POST (returns mcp-session-id header). Subsequent requests with the session header are forwarded to the session transport.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: {
            "200": { description: "MCP response" },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        get: {
          tags: ["MCP"],
          summary: "MCP SSE stream (existing session)",
          parameters: [{ name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "SSE stream" } },
        },
        delete: {
          tags: ["MCP"],
          summary: "Close MCP session",
          parameters: [{ name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } }],
          responses: { "204": { description: "Session closed" } },
        },
      },

      // ── MCP Discovery ─────────────────────────────────────────
      "/api/.well-known/mcp.json": {
        get: {
          tags: ["MCP"],
          summary: "MCP discovery document",
          security: [],
          responses: { "200": { description: "MCP server metadata", content: { "application/json": { schema: { $ref: "#/components/schemas/McpDiscovery" } } } } },
        },
      },

      // ── Docs ──────────────────────────────────────────────────
      "/api/docs/openapi.json": {
        get: {
          tags: ["System"],
          summary: "OpenAPI 3.1 specification (JSON)",
          security: [],
          responses: { "200": { description: "OpenAPI spec", content: { "application/json": { schema: { type: "object" } } } } },
        },
      },
      "/api/docs": {
        get: {
          tags: ["System"],
          summary: "Interactive API documentation (Scalar)",
          security: [],
          responses: { "200": { description: "HTML documentation page", content: { "text/html": { schema: { type: "string" } } } } },
        },
      },
    },
  };

  return spec;
}

// ---------------------------------------------------------------------------
// Helper: generate standard CRUD path entries
// ---------------------------------------------------------------------------
function crudPaths(
  resource: string,
  schemaName: string,
  tag: string,
  opts: {
    listParams?: any[];
    createSchema?: string;
    updateSchema?: string;
  } = {},
) {
  const createSchema = opts.createSchema ?? `${schemaName}Create`;
  const updateSchema = opts.updateSchema ?? `${schemaName}Update`;

  return {
    [`/api/${resource}`]: {
      get: {
        tags: [tag],
        summary: `List ${resource}`,
        parameters: opts.listParams ?? [],
        responses: {
          "200": {
            description: `${schemaName} list`,
            content: { "application/json": { schema: { type: "array", items: { $ref: `#/components/schemas/${schemaName}` } } } },
          },
        },
      },
      post: {
        tags: [tag],
        summary: `Create a ${schemaName.toLowerCase()}`,
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${createSchema}` } } } },
        responses: {
          "201": {
            description: `${schemaName} created`,
            content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } },
          },
        },
      },
    },
    [`/api/${resource}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get a ${schemaName.toLowerCase()} by ID`,
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "200": { description: schemaName, content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: [tag],
        summary: `Update a ${schemaName.toLowerCase()}`,
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${updateSchema}` } } } },
        responses: {
          "200": { description: `${schemaName} updated`, content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${schemaName.toLowerCase()}`,
        parameters: [{ $ref: "#/components/parameters/IdParam" }],
        responses: {
          "200": { description: `${schemaName} deleted`, content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
        },
      },
    },
  };
}
