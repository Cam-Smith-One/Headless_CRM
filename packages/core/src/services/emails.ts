import { z } from "zod";
import type { CrmContext, EventEmitter } from "../types";
import { createActivitiesService } from "./activities";

export const sendEmailSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string(),
  body: z.string(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  replyTo: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export const logEmailSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string(),
  body: z.string(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type LogEmailInput = z.infer<typeof logEmailSchema>;

export function createEmailService(db: any, events: EventEmitter) {
  const activitiesService = createActivitiesService(db, events);

  return {
    async send(ctx: CrmContext, input: SendEmailInput) {
      const parsed = sendEmailSchema.parse(input);
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM || "crm@headless-crm.dev";
      const to = Array.isArray(parsed.to) ? parsed.to : [parsed.to];

      let resendId: string | undefined;

      if (apiKey) {
        const payload: Record<string, unknown> = {
          from,
          to,
          subject: parsed.subject,
          html: parsed.body,
        };
        if (parsed.cc) payload.cc = Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc];
        if (parsed.bcc) payload.bcc = Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc];
        if (parsed.replyTo) payload.reply_to = parsed.replyTo;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Resend API error (${res.status}): ${err}`);
        }

        const data = await res.json();
        resendId = data.id;
      }

      // Log as activity
      const activity = await activitiesService.log(ctx, {
        type: "email",
        subject: parsed.subject,
        body: parsed.body,
        direction: "outbound",
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        metadata: {
          from,
          to,
          cc: parsed.cc,
          bcc: parsed.bcc,
          replyTo: parsed.replyTo,
          resendId,
          sent: !!apiKey,
        },
      });

      return { activity, sent: !!apiKey, resendId };
    },

    async log(ctx: CrmContext, input: LogEmailInput) {
      const parsed = logEmailSchema.parse(input);
      const to = Array.isArray(parsed.to) ? parsed.to : [parsed.to];

      const activity = await activitiesService.log(ctx, {
        type: "email",
        subject: parsed.subject,
        body: parsed.body,
        direction: parsed.direction,
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        metadata: {
          from: parsed.from,
          to,
        },
      });

      return activity;
    },

    async getThread(ctx: CrmContext, contactId: string) {
      return activitiesService.getByRecord(ctx, "contact", contactId, {
        limit: 100,
        type: "email",
      });
    },

    async getByRecord(
      ctx: CrmContext,
      recordType: "contact" | "company" | "deal",
      recordId: string
    ) {
      return activitiesService.getByRecord(ctx, recordType, recordId, {
        limit: 100,
        type: "email",
      });
    },
  };
}
