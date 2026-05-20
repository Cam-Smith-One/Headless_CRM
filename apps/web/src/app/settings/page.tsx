"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiFetchNoAuth, adminPost, apiPost } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface SetupStatus {
  configured: boolean;
}

interface ProvisionedAgent {
  id: string;
  name: string;
  type: string;
  role: string;
  status: string;
}

export default function SettingsPage() {
  const { token, adminKey, setToken, setAdminKey } = useAuth();

  // Setup status
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);

  // Connection test
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  // Agent list
  const [agents, setAgents] = useState<ProvisionedAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Quick provision
  const [provisionName, setProvisionName] = useState("");
  const [provisionTenant, setProvisionTenant] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState("");
  const [provisionResult, setProvisionResult] = useState<{ agentId: string; apiKey: string } | null>(null);

  // Advanced manual section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localToken, setLocalToken] = useState(token);
  const [localAdminKey, setLocalAdminKey] = useState(adminKey);

  // Import
  const [importCollection, setImportCollection] = useState("contacts");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: { index: number; error: string }[] } | null>(null);
  const [importError, setImportError] = useState("");

  // Clipboard feedback
  const [copiedField, setCopiedField] = useState("");

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  }

  // Fetch setup status on mount
  useEffect(() => {
    apiFetchNoAuth<SetupStatus>("/api/setup/status")
      .then(setSetupStatus)
      .catch(() => setSetupStatus(null))
      .finally(() => setSetupLoading(false));
  }, []);

  // Fetch agents when token is available
  const fetchAgents = useCallback(() => {
    if (!token) return;
    setAgentsLoading(true);
    apiFetch<ProvisionedAgent[]>("/api/agents", { token })
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoading(false));
  }, [token]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  async function handleTestConnection() {
    setTestStatus("testing");
    setTestMsg("Testing connection...");
    try {
      await apiFetch("/api/agents", { token });
      setTestStatus("ok");
      setTestMsg("Connection successful — token is valid.");
    } catch (e: any) {
      setTestStatus("error");
      setTestMsg(e.message ?? "Connection failed.");
    }
  }

  function handleSaveManual() {
    setToken(localToken);
    setAdminKey(localAdminKey);
    setTestMsg("Saved to localStorage.");
    setTestStatus("idle");
  }

  async function handleQuickProvision() {
    if (!provisionName || !provisionTenant) return;
    setProvisioning(true);
    setProvisionError("");
    setProvisionResult(null);
    try {
      const result = await adminPost<any>(
        "/api/agents/provision",
        { name: provisionName, tenantId: provisionTenant, type: "autonomous", role: "operator" },
        adminKey
      );
      const apiKey = result.apiKey ?? result.token ?? "";
      const agentId = result.agent?.id ?? result.id ?? "";
      setProvisionResult({ agentId, apiKey });
      setProvisionName("");
      setProvisionTenant("");
      // Refresh agents list and setup status
      fetchAgents();
      apiFetchNoAuth<SetupStatus>("/api/setup/status")
        .then(setSetupStatus)
        .catch(() => {});
    } catch (e: any) {
      setProvisionError(e.message);
    } finally {
      setProvisioning(false);
    }
  }

  function getMcpConfig(apiKey: string) {
    return JSON.stringify(
      {
        mcpServers: {
          "headless-crm": {
            url: `${API_URL}/mcp`,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      },
      null,
      2
    );
  }

  function maskKey(key: string) {
    if (!key) return "";
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  return (
    <div>
      <PageHeader title="Settings" description="API configuration & agent provisioning" />

      <div className="p-6 max-w-2xl space-y-8">
        {/* System Status */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">System Status</h2>
          {setupLoading ? (
            <p className="text-xs text-muted-foreground">Checking API status...</p>
          ) : setupStatus ? (
            <Card className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${setupStatus.configured ? "bg-green-500" : "bg-yellow-500"}`} />
                  <span className="text-sm">
                    Admin key: {setupStatus.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                {setupStatus.configured && adminKey && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {maskKey(adminKey)}
                    </code>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${agents.length > 0 ? "bg-green-500" : "bg-zinc-500"}`} />
                  <span className="text-sm">
                    Provisioned agents: {agents.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${token ? "bg-green-500" : "bg-zinc-500"}`} />
                  <span className="text-sm">
                    API token: {token ? "Set" : "Not set"}
                  </span>
                </div>
                {token && (
                  <div className="pt-1">
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleTestConnection} disabled={testStatus === "testing"}>
                      {testStatus === "testing" ? "Testing..." : "Test Connection"}
                    </Button>
                    {testMsg && (
                      <span className={`ml-3 text-xs font-mono ${testStatus === "ok" ? "text-green-400" : testStatus === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                        {testMsg}
                      </span>
                    )}
                  </div>
                )}
                {agents.length === 0 && setupStatus.configured && !agentsLoading && (
                  <p className="text-xs text-yellow-400 pt-1">
                    No agents provisioned yet. Use Quick Provision below to create your first agent.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-xs text-red-400">Could not reach API. Is the server running?</p>
          )}
        </section>

        {/* Quick Provision */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Quick Provision</h2>
          <p className="text-xs text-muted-foreground">
            Create a new agent with default settings (autonomous / operator) and get the API key instantly.
          </p>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Agent Name</label>
                  <Input
                    className="mt-1 text-xs"
                    value={provisionName}
                    onChange={(e) => setProvisionName(e.target.value)}
                    placeholder="My Agent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tenant ID</label>
                  <Input
                    className="mt-1 text-xs font-mono"
                    value={provisionTenant}
                    onChange={(e) => setProvisionTenant(e.target.value)}
                    placeholder="tenant_default"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleQuickProvision}
                disabled={provisioning || !provisionName || !provisionTenant || !adminKey}
              >
                {provisioning ? "Provisioning..." : "Provision Agent"}
              </Button>
              {!adminKey && (
                <p className="text-xs text-yellow-400">Set your admin key first (see Advanced section below).</p>
              )}
              {provisionError && <p className="text-xs text-red-400">{provisionError}</p>}
            </CardContent>
          </Card>
        </section>

        {/* Provision Result */}
        {provisionResult && (
          <section className="space-y-3">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-semibold">Agent Provisioned Successfully</span>
                </div>
                <p className="text-xs text-yellow-400 font-medium">
                  Save this API key now — it will not be shown again.
                </p>
                <div>
                  <label className="text-xs text-muted-foreground">API Key</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded border border-border bg-secondary px-3 py-2 text-xs font-mono break-all">
                      {provisionResult.apiKey}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => copyToClipboard(provisionResult.apiKey, "apiKey")}
                    >
                      {copiedField === "apiKey" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    MCP Connection Config (for Claude Desktop / MCP clients)
                  </label>
                  <div className="relative mt-1">
                    <pre className="rounded border border-border bg-secondary px-3 py-2 text-xs font-mono break-all whitespace-pre-wrap overflow-x-auto">
                      {getMcpConfig(provisionResult.apiKey)}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2 h-7 text-[11px]"
                      onClick={() => copyToClipboard(getMcpConfig(provisionResult.apiKey), "mcpConfig")}
                    >
                      {copiedField === "mcpConfig" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setToken(provisionResult.apiKey);
                      setLocalToken(provisionResult.apiKey);
                    }}
                  >
                    Use as Active Token
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setProvisionResult(null)}>
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Provisioned Agents */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Provisioned Agents</h2>
            {token && (
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={fetchAgents} disabled={agentsLoading}>
                {agentsLoading ? "Loading..." : "Refresh"}
              </Button>
            )}
          </div>
          {!token ? (
            <p className="text-xs text-muted-foreground">Set an API token to view provisioned agents.</p>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No agents found.</p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <Card key={agent.id} className="bg-card/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-xs font-mono font-semibold text-muted-foreground">
                        {agent.name?.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{agent.name}</span>
                        <p className="text-[11px] text-muted-foreground font-mono">{agent.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{agent.type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{agent.role}</Badge>
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          agent.status === "active" ? "bg-green-500" : "bg-zinc-500"
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Import Data */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Import Data</h2>
          <p className="text-xs text-muted-foreground">
            Upload a CSV file to import records into a collection. The first row must be column headers.
          </p>
          <Card className="bg-card/50">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Collection</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground"
                  value={importCollection}
                  onChange={(e) => setImportCollection(e.target.value)}
                >
                  <option value="contacts">Contacts</option>
                  <option value="companies">Companies</option>
                  <option value="deals">Deals</option>
                  <option value="cases">Cases</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary/80"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult(null);
                    setImportError("");
                  }}
                />
              </div>
              <Button
                size="sm"
                disabled={importing || !importFile || !token}
                onClick={async () => {
                  if (!importFile || !token) return;
                  setImporting(true);
                  setImportResult(null);
                  setImportError("");
                  try {
                    const text = await importFile.text();
                    const lines = text.split("\n").filter((l) => l.trim());
                    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
                    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
                    const records = lines.slice(1).map((line) => {
                      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
                      const obj: Record<string, string> = {};
                      headers.forEach((h, i) => { if (values[i]) obj[h] = values[i]; });
                      return obj;
                    });
                    const result = await apiPost<{ imported: number; failed: number; errors: { index: number; error: string }[] }>(
                      `/api/${importCollection}/import`,
                      { records },
                      token,
                    );
                    setImportResult(result);
                  } catch (e: any) {
                    setImportError(e.message);
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {importing ? "Importing..." : "Import Records"}
              </Button>
              {!token && (
                <p className="text-xs text-yellow-400">Set an API token first to import data.</p>
              )}
              {importError && <p className="text-xs text-red-400">{importError}</p>}
              {importResult && (
                <div className="space-y-1">
                  <p className="text-xs">
                    <span className="text-green-400 font-medium">{importResult.imported} imported</span>
                    {importResult.failed > 0 && (
                      <span className="text-red-400 font-medium ml-2">{importResult.failed} failed</span>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded border border-border bg-secondary p-2">
                      {importResult.errors.map((e) => (
                        <p key={e.index} className="text-[11px] text-red-400 font-mono">
                          Row {e.index + 1}: {e.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Advanced / Manual Key Entry */}
        <section className="space-y-3">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="text-xs">{showAdvanced ? "\u25BC" : "\u25B6"}</span>
            Advanced: Manual Key Configuration
          </button>
          {showAdvanced && (
            <Card className="bg-card/50">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">API Token</label>
                  <p className="text-[11px] text-muted-foreground">Bearer token for agent operations (contacts, deals, etc.)</p>
                  <Input
                    type="password"
                    value={localToken}
                    onChange={(e) => setLocalToken(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Admin Key</label>
                  <p className="text-[11px] text-muted-foreground">Used for provisioning new agents (X-Admin-Key header)</p>
                  <Input
                    type="password"
                    value={localAdminKey}
                    onChange={(e) => setLocalAdminKey(e.target.value)}
                    placeholder="admin-secret-key"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={handleSaveManual}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={handleTestConnection} disabled={!localToken}>
                    Test Connection
                  </Button>
                </div>
                {testMsg && (
                  <p className={`text-xs font-mono ${testStatus === "ok" ? "text-green-400" : testStatus === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                    {testMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
