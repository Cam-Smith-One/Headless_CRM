import { eq, and, sql } from "drizzle-orm";
import { customFieldDefinitions } from "@headless-crm/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { CrmContext } from "../types";

const fieldTypeEnum = z.enum([
  "text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "url",
  "email",
]);

const collectionEnum = z.enum(["contacts", "companies", "deals", "cases"]);

export const defineFieldSchema = z.object({
  collection: collectionEnum,
  fieldName: z.string().min(1),
  fieldType: fieldTypeEnum,
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

export const updateFieldSchema = defineFieldSchema.partial().omit({
  collection: true,
  fieldName: true,
});

export type DefineFieldInput = z.infer<typeof defineFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;

export function createCustomFieldsService(db: any) {
  return {
    async define(ctx: CrmContext, input: DefineFieldInput) {
      const parsed = defineFieldSchema.parse(input);
      const id = nanoid();

      const [record] = await db
        .insert(customFieldDefinitions)
        .values({
          id,
          tenantId: ctx.tenantId,
          ...parsed,
        })
        .returning();

      return record;
    },

    async list(ctx: CrmContext, collection?: string) {
      const conditions = [
        eq(customFieldDefinitions.tenantId, ctx.tenantId),
        eq(customFieldDefinitions.active, true),
      ];

      if (collection) {
        conditions.push(eq(customFieldDefinitions.collection, collection));
      }

      const data = await db
        .select()
        .from(customFieldDefinitions)
        .where(and(...conditions))
        .orderBy(
          customFieldDefinitions.collection,
          customFieldDefinitions.displayOrder
        );

      return data;
    },

    async getById(ctx: CrmContext, id: string) {
      const [record] = await db
        .select()
        .from(customFieldDefinitions)
        .where(
          and(
            eq(customFieldDefinitions.id, id),
            eq(customFieldDefinitions.tenantId, ctx.tenantId)
          )
        );
      return record ?? null;
    },

    async update(ctx: CrmContext, id: string, input: UpdateFieldInput) {
      const parsed = updateFieldSchema.parse(input);
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Custom field definition ${id} not found`);

      const [record] = await db
        .update(customFieldDefinitions)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customFieldDefinitions.id, id),
            eq(customFieldDefinitions.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return record;
    },

    async delete(ctx: CrmContext, id: string) {
      const existing = await this.getById(ctx, id);
      if (!existing) throw new Error(`Custom field definition ${id} not found`);

      const [record] = await db
        .update(customFieldDefinitions)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(customFieldDefinitions.id, id),
            eq(customFieldDefinitions.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return record;
    },

    async validate(
      ctx: CrmContext,
      collection: string,
      customFields: Record<string, unknown> | undefined
    ): Promise<{ valid: boolean; errors: string[] }> {
      const definitions = await this.list(ctx, collection);
      const errors: string[] = [];

      if (!definitions.length) {
        return { valid: true, errors: [] };
      }

      const fields = customFields ?? {};

      for (const def of definitions) {
        const value = fields[def.fieldName];

        // Check required
        if (
          def.required &&
          (value === undefined || value === null || value === "")
        ) {
          errors.push(`Custom field "${def.fieldName}" is required`);
          continue;
        }

        if (value === undefined || value === null) continue;

        // Check type
        switch (def.fieldType) {
          case "text":
          case "url":
          case "email":
            if (typeof value !== "string") {
              errors.push(
                `Custom field "${def.fieldName}" must be a string`
              );
            }
            break;
          case "number":
            if (typeof value !== "number") {
              errors.push(
                `Custom field "${def.fieldName}" must be a number`
              );
            }
            break;
          case "boolean":
            if (typeof value !== "boolean") {
              errors.push(
                `Custom field "${def.fieldName}" must be a boolean`
              );
            }
            break;
          case "date":
            if (typeof value !== "string" || isNaN(Date.parse(value as string))) {
              errors.push(
                `Custom field "${def.fieldName}" must be a valid date string`
              );
            }
            break;
          case "select":
            if (typeof value !== "string") {
              errors.push(
                `Custom field "${def.fieldName}" must be a string`
              );
            } else if (
              def.options &&
              Array.isArray(def.options) &&
              !(def.options as string[]).includes(value as string)
            ) {
              errors.push(
                `Custom field "${def.fieldName}" must be one of: ${(def.options as string[]).join(", ")}`
              );
            }
            break;
          case "multiselect":
            if (!Array.isArray(value)) {
              errors.push(
                `Custom field "${def.fieldName}" must be an array`
              );
            } else if (def.options && Array.isArray(def.options)) {
              const opts = def.options as string[];
              for (const v of value as string[]) {
                if (!opts.includes(v)) {
                  errors.push(
                    `Custom field "${def.fieldName}" contains invalid option "${v}". Valid options: ${opts.join(", ")}`
                  );
                }
              }
            }
            break;
        }
      }

      return { valid: errors.length === 0, errors };
    },
  };
}
