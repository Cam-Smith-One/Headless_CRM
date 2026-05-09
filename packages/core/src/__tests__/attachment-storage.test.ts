import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteAttachmentContent,
  loadAttachmentBuffer,
  storeAttachment,
} from "../attachment-storage";

const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
});

describe("attachment storage", () => {
  it("stores and reads database-backed attachments", async () => {
    process.env.ATTACHMENTS_STORAGE = "db";
    const buffer = Buffer.from("hello from db");

    const stored = await storeAttachment({
      id: "att_db_1",
      tenantId: "tenant_test",
      recordType: "contact",
      filename: "note.txt",
      buffer,
    });

    expect(stored.url).toBeNull();
    expect(stored.data).toBeTruthy();

    const loaded = await loadAttachmentBuffer({
      id: "att_db_1",
      tenantId: "tenant_test",
      recordType: "contact",
      filename: "note.txt",
      data: stored.data,
      url: stored.url,
    });

    expect(loaded.toString("utf8")).toBe("hello from db");
  });

  it("stores, reads, and deletes disk-backed attachments", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "headless-crm-attachments-"));
    process.env.ATTACHMENTS_STORAGE = "disk";
    process.env.ATTACHMENTS_DIR = tmpDir;

    const stored = await storeAttachment({
      id: "att_disk_1",
      tenantId: "tenant_test",
      recordType: "contact",
      filename: "contract.pdf",
      buffer: Buffer.from("disk attachment"),
    });

    expect(stored.data).toBeNull();
    expect(stored.url).toMatch(/^disk:\/\//);

    const loaded = await loadAttachmentBuffer({
      id: "att_disk_1",
      tenantId: "tenant_test",
      recordType: "contact",
      filename: "contract.pdf",
      url: stored.url,
      data: null,
    });

    expect(loaded.toString("utf8")).toBe("disk attachment");

    await deleteAttachmentContent({
      id: "att_disk_1",
      tenantId: "tenant_test",
      recordType: "contact",
      filename: "contract.pdf",
      url: stored.url,
      data: null,
    });

    const relativePath = decodeURIComponent((stored.url ?? "").replace("disk://", ""));
    const absolutePath = path.join(tmpDir, relativePath);
    await expect(readFile(absolutePath)).rejects.toThrow();
    await rm(tmpDir, { recursive: true, force: true });
  });
});
