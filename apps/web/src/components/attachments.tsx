"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// TODO: Migrate from base64 DB storage to Vercel Blob for production use.

const API_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "")
    : "";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("hcrm_token");
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedByAgentId?: string | null;
}

interface AttachmentsSectionProps {
  recordType: string;
  recordId: string;
}

export function AttachmentsSection({ recordType, recordId }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = useCallback(async () => {
    try {
      const token = getStoredToken();
      const res = await fetch(
        `${API_URL}/api/attachments?recordType=${encodeURIComponent(recordType)}&recordId=${encodeURIComponent(recordId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Failed to load attachments");
      const data = await res.json();
      setAttachments(Array.isArray(data) ? data : []);
    } catch {
      setAttachments([]);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const token = getStoredToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordType", recordType);
      formData.append("recordId", recordId);

      const res = await fetch(`${API_URL}/api/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(body.error ?? "Upload failed");
      }

      await loadAttachments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_URL}/api/attachments/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Delete failed");
      await loadAttachments();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDownload(att: Attachment) {
    const token = getStoredToken();
    const url = `${API_URL}/api/attachments/${att.id}/download`;
    // Open in new tab with auth header via fetch + blob
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = att.filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => setError("Download failed"));
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Attachments</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No attachments</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="font-medium truncate flex-1">{att.filename}</span>
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-5 shrink-0">
                {formatFileSize(att.size)}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
                {new Date(att.createdAt).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleDownload(att)}
              >
                Download
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => handleDelete(att.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
