export { createCRM } from "./crm";
export type { CRM } from "./crm";
export type {
  CollectionName,
  CrmContext,
  QueryOptions,
  CrmEvent,
  EventEmitter,
  PaginatedResult,
} from "./types";
export {
  createContactSchema,
  updateContactSchema,
  type CreateContactInput,
  type UpdateContactInput,
} from "./services/contacts";
export {
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "./services/companies";
export {
  createDealSchema,
  updateDealSchema,
  type CreateDealInput,
  type UpdateDealInput,
} from "./services/deals";
export {
  createActivitySchema,
  type CreateActivityInput,
} from "./services/activities";
export {
  createCaseSchema,
  updateCaseSchema,
  type CreateCaseInput,
  type UpdateCaseInput,
} from "./services/cases";
export {
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhooksService,
} from "./services/webhooks";
export {
  defineFieldSchema,
  updateFieldSchema,
  type DefineFieldInput,
  type UpdateFieldInput,
} from "./services/custom-fields";
export {
  createEmbeddingsService,
  type EmbeddingsService,
} from "./services/embeddings";
export {
  createApprovalsService,
  createApprovalSchema,
  type CreateApprovalInput,
  type ApprovalsService,
} from "./services/approvals";
export {
  createPipelineTriggersService,
  createTriggerSchema,
  updateTriggerSchema,
  type CreateTriggerInput,
  type UpdateTriggerInput,
} from "./services/pipeline-triggers";
