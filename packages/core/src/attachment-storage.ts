import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type AttachmentStorageMode = "db" | "disk";

export interface AttachmentStorageSummary {
  mode: AttachmentStorageMode;
  directory: string | null;
  maxBytes: number;
}

export interface AttachmentContentRecord {
  id: string;
  tenantId: string;
  recordType: string;
  filename: string;
  url?: string | null;
  data?: string | null;
}

export interface StoreAttachmentInput {
  id: string;
  tenantId: string;
  recordType: string;
  filename: string;
  buffer: Buffer;
}

const DEFAULT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const DISK_URL_PREFIX = "disk://";

function sanitizeExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (!ext || ext === ".") return "";
  return ext.slice(0, 16);
}

function normalizeStorageMode(raw: string | undefined): AttachmentStorageMode {
  return raw === "disk" ? "disk" : "db";
}

function resolveAttachmentDirectory(raw: string | undefined): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), raw || "storage/attachments");
}

function getRelativePathFromDiskUrl(url: string): string {
  if (!url.startsWith(DISK_URL_PREFIX)) {
    throw new Error("Unsupported attachment URL");
  }
  const relativePath = decodeURIComponent(url.slice(DISK_URL_PREFIX.length));
  const normalized = path.normalize(relativePath);
  if (
    normalized.startsWith("..") ||
    path.isAbsolute(normalized) ||
    normalized.includes(`..${path.sep}`)
  ) {
    throw new Error("Unsafe attachment path");
  }
  return normalized;
}

function buildDiskUrl(relativePath: string): string {
  return `${DISK_URL_PREFIX}${encodeURIComponent(relativePath)}`;
}

export function getAttachmentStorageSummary(): AttachmentStorageSummary {
  return {
    mode: normalizeStorageMode(process.env.ATTACHMENTS_STORAGE),
    directory:
      normalizeStorageMode(process.env.ATTACHMENTS_STORAGE) === "disk"
        ? resolveAttachmentDirectory(process.env.ATTACHMENTS_DIR)
        : null,
    maxBytes: getAttachmentMaxBytes(),
  };
}

export function getAttachmentMaxBytes(): number {
  const parsed = Number.parseInt(process.env.ATTACHMENTS_MAX_BYTES ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ATTACHMENT_MAX_BYTES;
  return parsed;
}

export async function ensureAttachmentStorageReady(): Promise<void> {
  const summary = getAttachmentStorageSummary();
  if (summary.mode === "disk" && summary.directory) {
    await mkdir(summary.directory, { recursive: true });
  }
}

export async function storeAttachment(input: StoreAttachmentInput): Promise<{ url: string | null; data: string | null }> {
  const summary = getAttachmentStorageSummary();
  if (summary.mode === "disk" && summary.directory) {
    const ext = sanitizeExtension(input.filename);
    const relativePath = path.join(input.tenantId, input.recordType, `${input.id}${ext}`);
    const absolutePath = path.join(summary.directory, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);
    return { url: buildDiskUrl(relativePath), data: null };
  }

  return {
    url: null,
    data: input.buffer.toString("base64"),
  };
}

export async function loadAttachmentBuffer(record: AttachmentContentRecord): Promise<Buffer> {
  if (record.data) {
    return Buffer.from(record.data, "base64");
  }

  if (record.url?.startsWith(DISK_URL_PREFIX)) {
    const summary = getAttachmentStorageSummary();
    if (!summary.directory) {
      throw new Error("ATTACHMENTS_DIR is required for disk attachment storage");
    }
    const relativePath = getRelativePathFromDiskUrl(record.url);
    return readFile(path.join(summary.directory, relativePath));
  }

  throw new Error(`Attachment ${record.id} has no readable content`);
}

export async function deleteAttachmentContent(record: AttachmentContentRecord): Promise<void> {
  if (!record.url?.startsWith(DISK_URL_PREFIX)) return;

  const summary = getAttachmentStorageSummary();
  if (!summary.directory) return;

  const relativePath = getRelativePathFromDiskUrl(record.url);
  await rm(path.join(summary.directory, relativePath), { force: true });
}
