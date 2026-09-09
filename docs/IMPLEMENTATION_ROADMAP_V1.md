# Procplus v1.0 — Implementation Roadmap

## Product objective
Build a testable enterprise procurement, project finance, compliance and audit platform for NGOs, companies, public institutions and donor-funded programmes.

## Delivery principles
- Multi-tenant by design.
- Role-based access and separation of duties.
- Configurable rules instead of donor thresholds hardcoded in application code.
- Immutable audit trail for material actions.
- Procurement linked to project, budget, contract, delivery and payment.
- AI recommendations must be explainable and reference the configured rule/source.
- Start as a modular application; split services only when scale/operations justify it.

## Sprint 0 — Foundation and quality
Deliverables:
- Repository conventions and environment configuration.
- Reusable design system and application shell.
- Error/loading/empty states.
- CI checks for build, lint and tests.
- Base data-access layer.

Acceptance: application builds reliably and protected routes share consistent layout and navigation.

## Sprint 1 — Organisations, authentication and RBAC
Deliverables:
- Organisations/tenants.
- Users, departments, roles and permissions.
- Login/session/logout.
- Tenant context.
- Permission guards for pages and actions.

Core permissions: procurement.create, procurement.approve, procurement.evaluate, procurement.award, finance.view, finance.approve, supplier.manage, contract.manage, compliance.manage, audit.view, admin.manage.

Acceptance: a user can only see tenant data and actions permitted by their role.

## Sprint 2 — Executive dashboard
Deliverables:
- KPI cards.
- Pending approvals.
- Compliance alerts.
- Contract deadlines.
- Recent activity.
- Links to operational modules.

Acceptance: dashboard data comes from a common data layer and navigation reaches working pages.

## Sprint 3 — Procurement core
Deliverables:
- Procurement list and filters.
- Nine-step Procurement Wizard.
- Draft/save/resume.
- Project and budget association.
- Lots and procurement method.
- Lifecycle statuses.

Lifecycle: DRAFT -> SUBMITTED -> IN_APPROVAL -> APPROVED -> PUBLISHED -> EVALUATION -> AWARDED -> CONTRACTED -> COMPLETED -> CANCELLED.

Acceptance: a process can be created, validated, submitted and traced through its lifecycle.

## Sprint 4 — Rules, workflow and compliance engine
Deliverables:
- Rule sets by organisation, donor/project and effective date.
- Value/currency/procurement-category conditions.
- Required quotations, publication, documents and approvals.
- Configurable approval workflow.
- Compliance checks, severity and score.
- Rule versioning.

Acceptance: changing an active rule version changes new compliance evaluations without changing source code; historic processes retain the rule version used.

## Sprint 5 — Suppliers and supplier portal
Deliverables:
- Supplier registry and prequalification.
- Categories, eligibility and documents.
- Expiry alerts.
- Invitations.
- Bid submission.
- Performance scorecards.

Acceptance: invited suppliers can submit before the deadline and cannot view competing bids.

## Sprint 6 — Evaluation and award
Deliverables:
- Evaluation committee.
- Conflict-of-interest declarations.
- Technical/financial criteria and weights.
- Individual scoring and consolidated matrix.
- Clarifications.
- Recommendation and award approval.

Acceptance: award is blocked when mandatory evaluation/compliance requirements are incomplete.

## Sprint 7 — Contracts and delivery
Deliverables:
- Contract creation from award.
- Amendments/versioning.
- Milestones, guarantees and expiries.
- Purchase orders where applicable.
- Goods/service receipt.
- Contract performance.

Acceptance: contract value and amendments remain traceable to the procurement decision.

## Sprint 8 — Project finance
Deliverables:
- Projects, donors and budgets.
- Budget lines and commitments.
- Payments and advances.
- Multi-currency transactions and exchange-rate records.
- Indirect-cost configuration.
- Budget execution and variance alerts.

Acceptance: procurement commitments, contracts and payments can be reconciled against available project budget.

## Sprint 9 — Documents and audit
Deliverables:
- Document metadata, categories and versions.
- Required-document checklist.
- Hash/integrity metadata.
- Immutable audit events with before/after snapshots for material changes.
- Process timeline.
- Audit workspace/export.

Acceptance: an auditor can reconstruct who did what, when, to which record and under which workflow/rule version.

## Sprint 10 — Reporting and exports
Deliverables:
- Procurement plan/status reports.
- Supplier and contract reports.
- Budget execution.
- Compliance exceptions.
- Audit report.
- CSV/XLSX/PDF exports where appropriate.

Acceptance: reports respect tenant and role permissions and reconcile to operational records.

## Sprint 11 — Procplus AI Copilot
Deliverables:
- Context-aware procurement assistant.
- Compliance explanation.
- Missing-document/risk summaries.
- Drafting assistance for RFQ/RFP/ToR/evaluation/contract documents.
- Knowledge-source references.
- Human confirmation before consequential actions.

Acceptance: AI cannot bypass permissions, approve, award or alter authoritative rules autonomously.

## Sprint 12 — Integrations and public API
Deliverables:
- Versioned REST API (/api/v1).
- OAuth/API credentials and scoped permissions.
- Webhooks with signatures and retries.
- ERP adapter interface.
- BI/export endpoints.
- Integration logs and idempotency.

Acceptance: an external sandbox client can safely create/read permitted resources and receive a signed test webhook.

## Sprint 13 — Security and production readiness
Deliverables:
- MFA/SSO readiness.
- Rate limiting and security headers.
- Secrets management.
- Backup/restore testing.
- Monitoring and structured logs.
- Data retention configuration.
- Dependency/security scanning.

Acceptance: critical security checks pass and restore procedure is tested.

## Sprint 14 — UAT and v1 release
Deliverables:
- End-to-end test scenarios.
- Pilot tenant.
- UAT issue resolution.
- Administrator/user documentation.
- Release checklist and rollback plan.

Acceptance: pilot users complete Request -> Approval -> RFQ -> Bid -> Evaluation -> Award -> Contract -> Delivery -> Payment -> Audit without manual database intervention.

## Initial domain model
Tenant core: companies, users, departments, roles, permissions, role_permissions, user_roles.

Programme/finance: donors, projects, project_budgets, budget_lines, exchange_rates, payments, advances.

Procurement: procurements, procurement_lots, procurement_items, bids, bid_items, evaluation_committees, evaluation_members, evaluation_criteria, evaluations, awards.

Rules/workflow: rule_sets, rule_versions, rules, workflow_definitions, workflow_steps, approval_instances, approvals, compliance_checks.

Supplier/contract: suppliers, supplier_documents, supplier_categories, prequalifications, supplier_scores, contracts, contract_amendments, guarantees, deliveries.

Governance: documents, document_versions, notifications, audit_logs, comments.

Every tenant-owned operational table should carry company_id (or be provably tenant-scoped through an enforced parent relation), created_at and updated_at. Material records should also carry created_by and version/status metadata.

## Immediate implementation order
1. Stabilise routing and application shell.
2. Replace localStorage-only authentication with an auth abstraction ready for a real backend.
3. Implement tenant/user/role/permission domain models.
4. Connect the existing Procurement Wizard to a repository/service layer with draft persistence.
5. Implement Rules Engine and compliance evaluation before adding more procurement screens.
6. Add automated tests around permission isolation and procurement/compliance decisions.

## Definition of Done
A feature is Done only when UI, validation, permission checks, persistence contract, audit behaviour, error states and tests are addressed. Mock data is acceptable during early UI development but must be clearly isolated behind repositories/services so it can be replaced without rewriting pages.
