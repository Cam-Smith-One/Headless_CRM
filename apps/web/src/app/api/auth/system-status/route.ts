import { accessSync, constants, existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getAttachmentStorageSummary } from "@headless-crm/core";
import { getFreshSessionUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getFreshSessionUser(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["owner", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachmentStorage = getAttachmentStorageSummary();
  const warnings: string[] = [];
  const attachmentDirectory = attachmentStorage.directory;
  let attachmentDirectoryExists = false;
  let attachmentDirectoryWritable = false;

  if (attachmentStorage.mode === "db") {
    warnings.push("Attachments are still stored in the database. Switch to disk or object storage for busier team deploys.");
  }

  if (attachmentDirectory) {
    attachmentDirectoryExists = existsSync(attachmentDirectory);
    if (!attachmentDirectoryExists) {
      warnings.push(`Attachment directory does not exist yet: ${attachmentDirectory}`);
    } else {
      try {
        accessSync(attachmentDirectory, constants.W_OK);
        attachmentDirectoryWritable = true;
      } catch {
        warnings.push(`Attachment directory is not writable: ${attachmentDirectory}`);
      }
    }
  }

  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (corsOrigins.includes("*")) {
    warnings.push("CORS_ORIGINS contains * which is unsafe for team or production deploys.");
  }
  if (!process.env.REDIS_URL) {
    warnings.push("REDIS_URL is not configured. Rate limiting stays per-process.");
  }
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    warnings.push("RESEND_WEBHOOK_SECRET is not configured. Signed email webhooks are unavailable.");
  }

  return NextResponse.json({
    userRole: user.role,
    attachmentStorage: {
      ...attachmentStorage,
      exists: attachmentDirectoryExists,
      writable: attachmentDirectoryWritable,
    },
    services: {
      redisConfigured: Boolean(process.env.REDIS_URL),
      resendWebhookSigningConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      oauthEnabled: process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true",
      corsOrigins,
    },
    warnings,
  });
}
