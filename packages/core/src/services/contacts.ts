import { eq, and, sql } from "drizzle-orm";
import { ilikeCompat } from "@headless-crm/db";
import { contacts, crmEvents, activities, dealContacts, cases, recordTags } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext, EventEmitter, PaginatedResult } from "../types";
import type { EmbeddingsService } from "./embeddings";

export const createContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().optional(),
  statusCode: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export function createContactsService(
  db: any,
  events: EventEmitter,
  customFieldValidator?: (ctx: CrmContext, collection: string, customFields: Record<string, unknown> | undefined) => Promise<{ valid: boolean; errors: string[] }>,
  embeddingsService?: EmbeddingsService
) {
  return {
    async create(ctx: CrmContext, input: CreateContactInput) {
      const parsed = createContactSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "contacts", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const id = nanoid();

      const [record] = await db
        .insert(contacts)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
          createdByAgentId: ctx.agentId,
          updatedByAgentId: ctx.agentId,
        })
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.created",
        recordType: "contacts",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: {},
      });

      // Generate embedding asynchronously
      if (embeddingsService) {
        embeddingsService.embedContact(ctx, id).catch(() => {});
      }

      return record;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        );
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateContactInput) {
      const parsed = updateContactSchema.parse(input);
      if (customFieldValidator) {
        const { valid, errors } = await customFieldValidator(ctx, "contacts", parsed.customFields);
        if (!valid) throw new Error(`Custom field validation failed: ${errors.join("; ")}`);
      }
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Contact ${id} not found`);

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes[key] = { before: (existing as any)[key], after: value };
        }
      }

      const [record] = await db
        .update(contacts)
        .set({
          ...parsed,
          updatedByAgentId: ctx.agentId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        )
        .returning();

      if (Object.keys(changes).length > 0) {
        await events.emit({
          tenantId: ctx.tenantId,
          eventType: "contacts.updated",
          recordType: "contacts",
          recordId: id,
          agentId: ctx.agentId,
          userId: ctx.userId,
          changes,
        });
      }

      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Contact ${id} not found`);

      const [record] = await db
        .update(contacts)
        .set({ stateCode: "archived", updatedAt: new Date() })
        .where(
          and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId))
        )
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.deleted",
        recordType: "contacts",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { stateCode: { before: existing.stateCode, after: "archived" } },
      });

      return record;
    },

    async query(
      ctx: CrmContext,
      options: { limit?: number; offset?: number; search?: string; companyId?: string }
    ): Promise<PaginatedResult<typeof contacts.$inferSelect>> {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const escapedSearch = options.search
        ? options.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
        : undefined;

      const whereCondition = and(
        eq(contacts.tenantId, ctx.tenantId),
        eq(contacts.stateCode, "active"),
        options.companyId ? eq(contacts.companyId, options.companyId) : undefined,
        escapedSearch
          ? ilikeCompat(
              sql`COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '') || ' ' || COALESCE(${contacts.email}, '')`,
              `%${escapedSearch}%`
            )
          : undefined
      );

      const data = await db
        .select()
        .from(contacts)
        .where(whereCondition)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(whereCondition);

      return {
        data,
        total: Number(count),
        limit,
        offset,
        hasMore: offset + data.length < Number(count),
      };
    },

    /**
     * Merge another contact into this one. The primary contact's fields win;
     * the other contact's non-null fields fill in any gaps. All FK references
     * are re-pointed to the primary, then the other contact is archived.
     */
    async merge(ctx: CrmContext, primaryId: string, otherId: string) {
      if (primaryId === otherId) throw new Error("Cannot merge a contact with itself");
      const [primary, other] = await Promise.all([
        this.getById(ctx, primaryId),
        this.getById(ctx, otherId),
      ]);
      if (!primary) throw new Error(`Contact ${primaryId} not found`);
      if (!other) throw new Error(`Contact ${otherId} not found`);

      // Fill missing fields from other into primary
      const mergedFields: Record<string, unknown> = {};
      for (const field of ["firstName", "lastName", "email", "phone", "title", "companyId"] as const) {
        if (!primary[field] && other[field]) mergedFields[field] = other[field];
      }
      // Merge customFields — other's fields fill gaps in primary's
      const primaryCF = (primary.customFields as Record<string, unknown>) ?? {};
      const otherCF = (other.customFields as Record<string, unknown>) ?? {};
      const mergedCF = { ...otherCF, ...primaryCF };
      if (JSON.stringify(mergedCF) !== JSON.stringify(primaryCF)) {
        mergedFields.customFields = mergedCF;
      }

      // Update primary if there are fields to merge
      if (Object.keys(mergedFields).length > 0) {
        await db
          .update(contacts)
          .set({ ...mergedFields, updatedByAgentId: ctx.agentId, updatedAt: new Date() })
          .where(and(eq(contacts.id, primaryId), eq(contacts.tenantId, ctx.tenantId)));
      }

      // Re-point FK references from other → primary
      await db.update(activities)
        .set({ contactId: primaryId })
        .where(and(eq(activities.contactId, otherId), eq(activities.tenantId, ctx.tenantId)));

      await db.update(cases as any)
        .set({ contactId: primaryId })
        .where(and(eq((cases as any).contactId, otherId), eq((cases as any).tenantId, ctx.tenantId)));

      // dealContacts has a composite PK (dealId, contactId) — avoid duplicate key errors
      // by fetching existing deal associations for the primary and only inserting new ones
      const existingDealLinks = await db
        .select({ dealId: dealContacts.dealId })
        .from(dealContacts)
        .where(eq(dealContacts.contactId, primaryId));
      const existingDealIds = new Set(existingDealLinks.map((r: any) => r.dealId));

      const otherDealLinks = await db
        .select({ dealId: dealContacts.dealId })
        .from(dealContacts)
        .where(eq(dealContacts.contactId, otherId));

      // Delete the other contact's deal links (we'll re-insert the new ones)
      if (otherDealLinks.length > 0) {
        await db.delete(dealContacts).where(eq(dealContacts.contactId, otherId));
        const newLinks = otherDealLinks
          .filter((r: any) => !existingDealIds.has(r.dealId))
          .map((r: any) => ({ dealId: r.dealId, contactId: primaryId }));
        if (newLinks.length > 0) {
          await db.insert(dealContacts).values(newLinks).onConflictDoNothing();
        }
      }

      // Re-point record_tags
      await db.update(recordTags)
        .set({ recordId: primaryId })
        .where(and(eq(recordTags.recordId, otherId), eq(recordTags.recordType, "contacts")));

      // Archive the merged-away contact
      await db
        .update(contacts)
        .set({ stateCode: "archived", updatedAt: new Date() })
        .where(and(eq(contacts.id, otherId), eq(contacts.tenantId, ctx.tenantId)));

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.merged",
        recordType: "contacts",
        recordId: primaryId,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: { mergedFrom: { before: null, after: otherId } },
        metadata: { mergedContactId: otherId },
      });

      return await this.getById(ctx, primaryId);
    },

    /**
     * Apply enrichment data to a contact. Standard fields (when provided) fill
     * in missing values; everything else goes into customFields.
     */
    async enrich(ctx: CrmContext, id: string, data: Record<string, unknown>) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Contact ${id} not found`);

      const standardFields = ["firstName", "lastName", "email", "phone", "title", "companyId"] as const;
      const updates: Record<string, unknown> = {};

      for (const field of standardFields) {
        if (data[field] !== undefined && !existing[field]) {
          updates[field] = data[field];
        }
        delete data[field];
      }

      // Remaining keys go into customFields
      if (Object.keys(data).length > 0) {
        const existingCF = (existing.customFields as Record<string, unknown>) ?? {};
        updates.customFields = { ...data, ...existingCF };
      }

      if (Object.keys(updates).length === 0) return existing;

      const [record] = await db
        .update(contacts)
        .set({ ...updates, updatedByAgentId: ctx.agentId, updatedAt: new Date() })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)))
        .returning();

      await events.emit({
        tenantId: ctx.tenantId,
        eventType: "contacts.enriched",
        recordType: "contacts",
        recordId: id,
        agentId: ctx.agentId,
        userId: ctx.userId,
        changes: Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [k, { before: (existing as any)[k], after: v }])
        ),
      });

      return record;
    },
  };
}
