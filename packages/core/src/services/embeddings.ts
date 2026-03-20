import { eq, and, sql, isNull } from "drizzle-orm";
import { contacts, companies } from "@headless-crm/db";
import type { CrmContext } from "../types";

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });

    if (!res.ok) {
      console.error("OpenAI embeddings error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.data[0].embedding;
  } catch (e) {
    console.error("Failed to generate embedding:", e);
    return null;
  }
}

function buildContactText(record: any): string {
  return [
    record.firstName,
    record.lastName,
    record.email,
    record.title,
    record.companyName,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCompanyText(record: any): string {
  return [record.name, record.domain, record.industry, record.size]
    .filter(Boolean)
    .join(" ");
}

export function createEmbeddingsService(db: any) {
  return {
    generateEmbedding,

    async embedContact(ctx: CrmContext, contactId: string) {
      const [record] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, contactId), eq(contacts.tenantId, ctx.tenantId))
        );
      if (!record) return null;

      const text = buildContactText(record);
      if (!text.trim()) return null;

      const embedding = await generateEmbedding(text);
      if (!embedding) return null;

      await db
        .update(contacts)
        .set({ embedding })
        .where(eq(contacts.id, contactId));

      return embedding;
    },

    async embedCompany(ctx: CrmContext, companyId: string) {
      const [record] = await db
        .select()
        .from(companies)
        .where(
          and(eq(companies.id, companyId), eq(companies.tenantId, ctx.tenantId))
        );
      if (!record) return null;

      const text = buildCompanyText(record);
      if (!text.trim()) return null;

      const embedding = await generateEmbedding(text);
      if (!embedding) return null;

      await db
        .update(companies)
        .set({ embedding })
        .where(eq(companies.id, companyId));

      return embedding;
    },

    async embedAll(
      ctx: CrmContext,
      collection: "contacts" | "companies"
    ): Promise<{ embedded: number; failed: number }> {
      const table = collection === "contacts" ? contacts : companies;
      const buildText =
        collection === "contacts" ? buildContactText : buildCompanyText;

      const records = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.tenantId, ctx.tenantId),
            eq(table.stateCode, "active"),
            isNull(table.embedding)
          )
        )
        .limit(100);

      let embedded = 0;
      let failed = 0;

      for (const record of records) {
        const text = buildText(record);
        if (!text.trim()) {
          failed++;
          continue;
        }

        const embedding = await generateEmbedding(text);
        if (!embedding) {
          failed++;
          continue;
        }

        await db
          .update(table)
          .set({ embedding })
          .where(eq(table.id, record.id));
        embedded++;
      }

      return { embedded, failed };
    },

    async semanticSearch(
      ctx: CrmContext,
      collection: "contacts" | "companies",
      query: string,
      limit: number = 10
    ) {
      const embedding = await generateEmbedding(query);
      if (!embedding) return [];

      const table = collection === "contacts" ? contacts : companies;
      const vectorLiteral = `[${embedding.join(",")}]`;

      const results = await db.execute(
        sql`SELECT *, (embedding <=> ${vectorLiteral}::vector) AS distance
            FROM ${table}
            WHERE tenant_id = ${ctx.tenantId}
              AND state_code = 'active'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${vectorLiteral}::vector
            LIMIT ${limit}`
      );

      return (results.rows ?? results).map((row: any) => ({
        ...row,
        similarity: 1 - (row.distance ?? 0),
      }));
    },
  };
}

export type EmbeddingsService = ReturnType<typeof createEmbeddingsService>;
