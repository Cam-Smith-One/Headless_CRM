import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { agentMemories } from "@headless-crm/db";
import type { CRM, CrmContext } from "@headless-crm/core";
import type { EventBus } from "@headless-crm/events";

export interface ToolDeps {
  crm: CRM;
  events: EventBus;
  ctx: CrmContext;
  db: any;
}

export function defineTools(deps: ToolDeps) {
  const { crm, events, ctx, db } = deps;

  return {
    crm_query: {
      description:
        "Query any collection with filters, sort, pagination, and field selection",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "activities", "cases"]),
        search: z.string().optional(),
        stage: z.string().optional(),
        pipelineId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        const { collection, ...options } = input;
        switch (collection) {
          case "contacts":
            return crm.contacts.query(ctx, options);
          case "companies":
            return crm.companies.query(ctx, options);
          case "deals":
            return crm.deals.query(ctx, options);
          case "cases":
            return crm.cases.query(ctx, options);
          case "activities": {
            const { desc, eq, and } = await import("drizzle-orm");
            const { activities } = await import("@headless-crm/db");
            const limit = options.limit ?? 50;
            const offset = options.offset ?? 0;
            const data = await db
              .select()
              .from(activities)
              .where(eq(activities.tenantId, ctx.tenantId))
              .orderBy(desc(activities.occurredAt))
              .limit(limit)
              .offset(offset);
            return { data, limit, offset };
          }
          default:
            throw new Error(`Collection ${collection} not supported for query`);
        }
      },
    },

    crm_get: {
      description:
        "Retrieve a single record by ID with optional related record expansion",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        id: z.string(),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        switch (input.collection) {
          case "contacts":
            return crm.contacts.getById(ctx, input.id);
          case "companies":
            return crm.companies.getById(ctx, input.id);
          case "deals":
            return crm.deals.getById(ctx, input.id);
          case "cases":
            return crm.cases.getById(ctx, input.id);
          default:
            throw new Error(`Collection ${input.collection} not supported`);
        }
      },
    },

    crm_search: {
      description: "Semantic and keyword search across all collections. Set semantic=true to use vector similarity search (requires embeddings).",
      inputSchema: z.object({
        query: z.string(),
        collections: z
          .array(z.enum(["contacts", "companies", "deals", "cases"]))
          .optional()
          .default(["contacts", "companies", "deals", "cases"]),
        limit: z.number().min(1).max(50).default(20),
        semantic: z.boolean().optional().default(false),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        const results: Record<string, unknown[]> = {};
        const collections = input.collections;

        if (input.semantic) {
          await Promise.all(
            collections.map(async (col: string) => {
              if (col === "contacts" || col === "companies") {
                results[col] = await crm.embeddings.semanticSearch(
                  ctx, col, input.query, input.limit
                );
              } else if (col === "deals") {
                const r = await crm.deals.query(ctx, { limit: input.limit });
                results.deals = r.data;
              } else if (col === "cases") {
                const r = await crm.cases.query(ctx, { search: input.query, limit: input.limit });
                results.cases = r.data;
              }
            })
          );
        } else {
          await Promise.all(
            collections.map(async (col: string) => {
              switch (col) {
                case "contacts": {
                  const r = await crm.contacts.query(ctx, {
                    search: input.query,
                    limit: input.limit,
                  });
                  results.contacts = r.data;
                  break;
                }
                case "companies": {
                  const r = await crm.companies.query(ctx, {
                    search: input.query,
                    limit: input.limit,
                  });
                  results.companies = r.data;
                  break;
                }
                case "deals": {
                  const r = await crm.deals.query(ctx, { limit: input.limit });
                  const q = input.query.toLowerCase();
                  results.deals = r.data.filter((d: any) =>
                    d.name?.toLowerCase().includes(q)
                  );
                  break;
                }
                case "cases": {
                  const r = await crm.cases.query(ctx, {
                    search: input.query,
                    limit: input.limit,
                  });
                  results.cases = r.data;
                  break;
                }
              }
            })
          );
        }

        return results;
      },
    },

    crm_schema: {
      description:
        "Retrieve the data model — collections, fields, types, relationships, and custom field definitions. Custom fields are included per collection. Use crm_list_fields for a focused view. Subscribe to custom_fields.defined / custom_fields.deleted events to be notified of schema changes.",
      inputSchema: z.object({
        collection: z
          .enum(["contacts", "companies", "deals", "activities", "pipelines", "tags", "cases"])
          .optional(),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        const schemas: Record<string, object> = {
          contacts: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "first_name", type: "text" },
              { name: "last_name", type: "text" },
              { name: "email", type: "text" },
              { name: "phone", type: "text" },
              { name: "title", type: "text" },
              { name: "company_id", type: "text", relation: "companies" },
              { name: "state_code", type: "text" },
              { name: "status_code", type: "text" },
              { name: "custom_fields", type: "jsonb" },
            ],
            relationships: { company: "companies", deals: "deals", activities: "activities" },
          },
          companies: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "name", type: "text", required: true },
              { name: "domain", type: "text" },
              { name: "industry", type: "text" },
              { name: "size", type: "text" },
              { name: "parent_company_id", type: "text", relation: "companies" },
              { name: "custom_fields", type: "jsonb" },
            ],
            relationships: { contacts: "contacts", deals: "deals", parent: "companies" },
          },
          deals: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "name", type: "text", required: true },
              { name: "value", type: "numeric" },
              { name: "currency", type: "text" },
              { name: "stage", type: "text", required: true },
              { name: "pipeline_id", type: "text", relation: "pipelines", required: true },
              { name: "company_id", type: "text", relation: "companies" },
              { name: "close_date", type: "timestamp" },
              { name: "custom_fields", type: "jsonb" },
            ],
            relationships: { company: "companies", contacts: "contacts", activities: "activities" },
          },
          activities: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "type", type: "enum", values: ["call", "email", "meeting", "note", "task", "agent_action"] },
              { name: "subject", type: "text" },
              { name: "body", type: "text" },
              { name: "direction", type: "text" },
              { name: "occurred_at", type: "timestamp" },
            ],
            relationships: { contact: "contacts", company: "companies", deal: "deals" },
          },
          pipelines: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "name", type: "text", required: true },
              { name: "stages", type: "jsonb" },
            ],
          },
          tags: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "name", type: "text", required: true },
              { name: "color", type: "text" },
              { name: "object_type", type: "text" },
            ],
          },
          cases: {
            fields: [
              { name: "id", type: "text", primary: true },
              { name: "title", type: "text", required: true },
              { name: "description", type: "text" },
              { name: "status", type: "enum", values: ["open", "in_progress", "waiting", "resolved", "closed"] },
              { name: "priority", type: "enum", values: ["low", "medium", "high", "urgent"] },
              { name: "category", type: "text" },
              { name: "contact_id", type: "text", relation: "contacts" },
              { name: "company_id", type: "text", relation: "companies" },
              { name: "deal_id", type: "text", relation: "deals" },
              { name: "assigned_agent_id", type: "text", relation: "agents" },
              { name: "resolved_at", type: "timestamp" },
              { name: "custom_fields", type: "jsonb" },
            ],
            relationships: { contact: "contacts", company: "companies", deal: "deals" },
          },
        };

        // Include custom field definitions
        const customFields = await crm.customFields.list(ctx);
        const customFieldsByCollection: Record<string, any[]> = {};
        for (const cf of customFields) {
          if (!customFieldsByCollection[cf.collection]) {
            customFieldsByCollection[cf.collection] = [];
          }
          customFieldsByCollection[cf.collection].push({
            name: cf.fieldName,
            type: cf.fieldType,
            required: cf.required,
            options: cf.options,
            description: cf.description,
          });
        }

        // Attach custom fields to each schema
        for (const [col, cfs] of Object.entries(customFieldsByCollection)) {
          if (schemas[col]) {
            (schemas[col] as any).customFields = cfs;
          }
        }

        if (input.collection) {
          return schemas[input.collection] ?? { error: "Unknown collection" };
        }
        return { collections: Object.keys(schemas), schemas };
      },
    },

    crm_create: {
      description: "Create a new record. Contacts: {firstName, lastName, email, phone, title, companyId}. Companies: {name, domain, industry, size}. Deals: {name, value, currency, stage, pipelineId, companyId}. Cases: {title, description, status, priority, category, contactId, companyId, dealId}. You can also pass 'name' or 'fullName' for contacts — it will be split into firstName/lastName automatically. Include 'customFields' object to set tenant-defined custom fields (use crm_list_fields to discover available fields).",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        data: z.record(z.unknown()).optional(),
      }).passthrough(),
      annotations: { readOnly: false },
      async execute(input: any) {
        // Handle agents that put fields at top level instead of in data
        const rawData = input.data ?? (() => {
          const { collection, ...rest } = input;
          return Object.keys(rest).length > 0 ? rest : {};
        })();
        const data = { ...rawData };
        // Auto-split name/fullName into firstName/lastName for contacts
        if (input.collection === "contacts") {
          const nameField = data.fullName || data.name;
          if (nameField && !data.firstName) {
            const parts = String(nameField).trim().split(/\s+/);
            data.firstName = parts[0];
            data.lastName = parts.slice(1).join(" ") || undefined;
            delete data.fullName;
            delete data.name;
          }
        }
        // Map common agent-sent field aliases
        if (data.jobTitle && !data.title) { data.title = data.jobTitle; delete data.jobTitle; }
        if (data.company && !data.companyId) { delete data.company; } // company name can't map to companyId automatically
        switch (input.collection) {
          case "contacts":
            return crm.contacts.create(ctx, data);
          case "companies":
            return crm.companies.create(ctx, data);
          case "deals":
            return crm.deals.create(ctx, data);
          case "cases":
            return crm.cases.create(ctx, data);
          default:
            throw new Error(`Cannot create in ${input.collection}`);
        }
      },
    },

    crm_update: {
      description: "Update specific fields on an existing record. Put fields to update inside 'data'. Include 'customFields' object to update tenant-defined custom fields (use crm_list_fields to discover available fields).",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        id: z.string(),
        data: z.record(z.unknown()).optional(),
      }).passthrough(),
      annotations: { readOnly: false },
      async execute(input: any) {
        const updateData = input.data ?? (() => {
          const { collection, id, ...rest } = input;
          return Object.keys(rest).length > 0 ? rest : {};
        })();
        switch (input.collection) {
          case "contacts":
            return crm.contacts.update(ctx, input.id, updateData);
          case "companies":
            return crm.companies.update(ctx, input.id, updateData);
          case "deals":
            return crm.deals.update(ctx, input.id, updateData);
          case "cases":
            return crm.cases.update(ctx, input.id, updateData);
          default:
            throw new Error(`Cannot update in ${input.collection}`);
        }
      },
    },

    crm_log_activity: {
      description:
        "Append an activity (call, email, note, meeting) to a record's timeline",
      inputSchema: z.object({
        type: z.enum(["call", "email", "meeting", "note", "task", "agent_action"]),
        subject: z.string().optional(),
        body: z.string().optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        dealId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.activities.log(ctx, input);
      },
    },

    crm_subscribe: {
      description:
        "Register a webhook subscription — agent is notified via HTTP POST when matching events occur. Supports wildcard patterns like 'contacts.*'.",
      inputSchema: z.object({
        eventTypes: z.array(z.string()),
        webhookUrl: z.string().url(),
        description: z.string().optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.webhooks.register(ctx, {
          url: input.webhookUrl,
          eventTypes: input.eventTypes,
          description: input.description,
        });
      },
    },

    crm_unsubscribe: {
      description: "Remove a webhook subscription by ID",
      inputSchema: z.object({
        subscriptionId: z.string(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.webhooks.delete(ctx, input.subscriptionId);
      },
    },

    crm_deal_add_contact: {
      description: "Associate a contact with a deal. Deals can have multiple contacts.",
      inputSchema: z.object({
        dealId: z.string(),
        contactId: z.string(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.deals.addContact(ctx, input.dealId, input.contactId);
      },
    },

    crm_deal_remove_contact: {
      description: "Remove a contact association from a deal.",
      inputSchema: z.object({
        dealId: z.string(),
        contactId: z.string(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.deals.removeContact(ctx, input.dealId, input.contactId);
      },
    },

    crm_deal_get_contacts: {
      description: "List all contact IDs associated with a deal.",
      inputSchema: z.object({
        dealId: z.string(),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        return { contactIds: await crm.deals.getContacts(ctx, input.dealId) };
      },
    },

    crm_delete: {
      description: "Soft-delete a record",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        id: z.string(),
      }),
      annotations: { readOnly: false, destructive: true },
      async execute(input: any) {
        switch (input.collection) {
          case "contacts":
            return crm.contacts.delete(ctx, input.id);
          case "companies":
            return crm.companies.delete(ctx, input.id);
          case "deals":
            return crm.deals.delete(ctx, input.id);
          case "cases":
            return crm.cases.delete(ctx, input.id);
          default:
            throw new Error(`Cannot delete from ${input.collection}`);
        }
      },
    },

    crm_bulk_update: {
      description:
        "Batch update multiple records of the same collection in one call",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        updates: z.array(
          z.object({
            id: z.string(),
            data: z.record(z.unknown()),
          })
        ),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        const service = (() => {
          switch (input.collection) {
            case "contacts":
              return crm.contacts;
            case "companies":
              return crm.companies;
            case "deals":
              return crm.deals;
            case "cases":
              return crm.cases;
            default:
              throw new Error(`Collection ${input.collection} not supported for bulk update`);
          }
        })();

        const results = await Promise.all(
          input.updates.map(async (u: { id: string; data: Record<string, unknown> }) => {
            try {
              const record = await service.update(ctx, u.id, u.data);
              return { id: u.id, success: true, record };
            } catch (error: any) {
              return { id: u.id, success: false, error: error.message };
            }
          })
        );

        return { results };
      },
    },

    crm_define_field: {
      description:
        "Define a custom field on a collection (contacts, companies, deals, cases). This extends the schema with tenant-specific fields that are validated when creating/updating records.",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        fieldName: z.string(),
        fieldType: z.enum(["text", "number", "boolean", "date", "select", "multiselect", "url", "email"]),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
        description: z.string().optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.customFields.define(ctx, input);
      },
    },

    crm_list_fields: {
      description:
        "List custom field definitions for a collection (or all collections). Use this to discover what custom fields are available before creating/updating records. Returns field name, type, required, options, and description.",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]).optional(),
      }),
      annotations: { readOnly: true },
      async execute(input: any) {
        const fields = await crm.customFields.list(ctx, input.collection);
        if (fields.length === 0) {
          return { fields: [], hint: "No custom fields defined yet. Use crm_define_field to create one." };
        }
        return {
          fields: fields.map((f: any) => ({
            id: f.id,
            collection: f.collection,
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            required: f.required,
            options: f.options,
            description: f.description,
            displayOrder: f.displayOrder,
          })),
        };
      },
    },

    crm_import: {
      description:
        "Bulk-import records into a collection. Each record is created individually so events are emitted. Returns counts of imported/failed and per-record error details.",
      inputSchema: z.object({
        collection: z.enum(["contacts", "companies", "deals", "cases"]),
        records: z.array(z.record(z.unknown())),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        const service = (() => {
          switch (input.collection) {
            case "contacts": return crm.contacts;
            case "companies": return crm.companies;
            case "deals": return crm.deals;
            case "cases": return crm.cases;
            default: throw new Error(`Collection ${input.collection} not supported for import`);
          }
        })();

        let imported = 0;
        let failed = 0;
        const errors: { index: number; error: string }[] = [];

        for (let i = 0; i < input.records.length; i++) {
          try {
            let data = { ...input.records[i] };
            // Auto-split name/fullName for contacts
            if (input.collection === "contacts") {
              const nameField = data.fullName || data.name;
              if (nameField && !data.firstName) {
                const parts = String(nameField).trim().split(/\s+/);
                data.firstName = parts[0];
                data.lastName = parts.slice(1).join(" ") || undefined;
                delete data.fullName;
                delete data.name;
              }
            }
            await (service as any).create(ctx, data);
            imported++;
          } catch (err: any) {
            failed++;
            errors.push({ index: i, error: err.message ?? String(err) });
          }
        }

        return { imported, failed, errors };
      },
    },

    crm_send_email: {
      description:
        "Send an email via the CRM and log it as an activity. Optionally associate with a contact, company, or deal.",
      inputSchema: z.object({
        to: z.union([z.string(), z.array(z.string())]),
        subject: z.string(),
        body: z.string(),
        cc: z.union([z.string(), z.array(z.string())]).optional(),
        bcc: z.union([z.string(), z.array(z.string())]).optional(),
        replyTo: z.string().optional(),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        dealId: z.string().optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.emails.send(ctx, input);
      },
    },

    crm_log_email: {
      description:
        "Log an inbound or outbound email as a CRM activity without sending it. Use for tracking emails received or sent outside the CRM.",
      inputSchema: z.object({
        direction: z.enum(["inbound", "outbound"]),
        from: z.string(),
        to: z.union([z.string(), z.array(z.string())]),
        subject: z.string(),
        body: z.string(),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        dealId: z.string().optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.emails.log(ctx, input);
      },
    },

    crm_memory_propose: {
      description:
        "Propose an agent memory (insight, preference, pattern, or relationship) for later recall",
      inputSchema: z.object({
        memory_type: z.enum(["insight", "preference", "pattern", "relationship"]),
        content: z.string(),
        confidence: z.number().min(0).max(1),
        related_entity_type: z.string(),
        related_entity_id: z.string(),
        ttl_days: z.number().int().positive().optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        if (!ctx.agentId) throw new Error("Agent identity required to store memories");
        const id = crypto.randomUUID();
        const ttlSeconds = input.ttl_days ? input.ttl_days * 86400 : null;

        await db.insert(agentMemories).values({
          id,
          tenantId: ctx.tenantId,
          agentId: ctx.agentId,
          subjectType: input.related_entity_type,
          subjectId: input.related_entity_id,
          content: input.content,
          confidence: input.confidence,
          ttlSeconds,
          metadata: { memory_type: input.memory_type },
        });

        return { id, stored: true };
      },
    },

    crm_request_approval: {
      description:
        "Request human approval for an action. Creates a pending approval that must be reviewed by a human before proceeding. Returns the approval object so the agent knows to wait.",
      inputSchema: z.object({
        type: z.enum(["agent_provision", "destructive_action", "bulk_operation", "escalation"]),
        title: z.string(),
        description: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        return crm.approvals.request(ctx, input);
      },
    },

    crm_attach_file: {
      description:
        "Attach a file to a CRM record (contact, company, deal, or case). Accepts base64-encoded file content. Returns the attachment metadata.",
      inputSchema: z.object({
        recordType: z.enum(["contact", "company", "deal", "case"]),
        recordId: z.string(),
        filename: z.string(),
        base64Content: z.string().describe("Base64-encoded file content"),
        mimeType: z.string().default("application/octet-stream"),
      }),
      annotations: { readOnly: false },
      async execute(input: any) {
        const { attachments } = await import("@headless-crm/db");
        const id = crypto.randomUUID();
        const buffer = Buffer.from(input.base64Content, "base64");

        const [record] = await db.insert(attachments).values({
          id,
          tenantId: ctx.tenantId,
          recordType: input.recordType,
          recordId: input.recordId,
          filename: input.filename,
          mimeType: input.mimeType,
          size: buffer.length,
          data: input.base64Content,
          uploadedByAgentId: ctx.agentId ?? null,
        }).returning();

        const { data: _data, ...meta } = record;
        return meta;
      },
    },
  };
}
