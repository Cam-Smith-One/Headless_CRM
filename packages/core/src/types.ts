export type CollectionName =
  | "contacts"
  | "companies"
  | "deals"
  | "activities"
  | "pipelines"
  | "tags"
  | "cases"
  | "approvals"
  | "custom_fields";

export interface CrmContext {
  tenantId: string;
  agentId?: string;
  userId?: string;
  role?: "reader" | "operator" | "developer" | "auditor";
}

export interface QueryOptions {
  collection: CollectionName;
  filters?: Record<string, unknown>;
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  fields?: string[];
}

export interface CrmEvent {
  eventType: string;
  recordType: CollectionName;
  recordId: string;
  agentId?: string;
  userId?: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

export interface EventEmitter {
  emit(event: CrmEvent & { tenantId: string }): Promise<void>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
