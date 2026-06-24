You are performing a complete, evidence-based design, implementation, and production-readiness exercise to deliver a production-grade PhonePe Payment Gateway (PG) integration across the server/ and web/ applications, replacing all temporary, mock, or placeholder payment mechanisms with a single authoritative payment architecture.

All decisions must be derived from repository evidence, documentation, ADRs, business requirements, and official PhonePe documentation. Do not make assumptions when repository evidence or official documentation can be used instead.

OPERATING PRINCIPLES

1. Repository-First
   Every decision must be derived from actual repository analysis.
   Never assume architecture, workflows, business rules, or implementation details.
   Verify all findings against code, documentation, ADRs, and runtime configuration.

2. Documentation-First
   Documentation and ADRs are architectural constraints.
   Existing documented decisions must be honored unless repository evidence proves they are obsolete or superseded.
   Do not exclude any document based on filename assumptions.

3. Single-Source-of-Truth
   Eliminate duplicate payment logic.
   Eliminate conflicting or parallel payment workflows.
   Establish one authoritative PhonePe-based payment architecture.

4. Production-Only Implementation
   Use the official PhonePe Sandbox environment for development and testing.
   Use the official PhonePe Production environment for live transactions.
   Do not create or maintain fake gateways, simulation engines, placeholder payment processors, or mock transaction workflows outside legitimate test suites.
   Use Hookdeck as the standard webhook-forwarding solution for local development.

5. Validation-Before-Execution
   Complete and validate each phase before proceeding to the next.
   Do not continue when unresolved architectural conflicts, business-rule conflicts, security concerns, or implementation ambiguities exist.

6. Security-First
   Security requirements take precedence over convenience.
   Apply defense-in-depth throughout payment initiation, callbacks, redirects, webhooks, refunds, reconciliation, and administrative workflows.
   Validate all payment inputs, callbacks, webhooks, signatures, and state transitions.

7. Evidence-Based Reporting
   Every finding, recommendation, architecture decision, risk, and implementation change must be traceable to repository analysis, documentation analysis, or official PhonePe documentation.

8. No Backward-Compatibility Assumptions
   Do not retain obsolete payment implementations solely for compatibility.
   Retain functionality only when justified by documented business requirements.

9. Completion Standard
   Do not declare completion until all validation, testing, documentation, readiness reviews, and implementation requirements are satisfied.

======================================================================
PHASE 1 — REPOSITORY AUDIT
======================================================================

Objective

Develop a complete understanding of the repository, architecture, workflows, dependencies, implementation patterns, operational characteristics, and payment ecosystem.

Analyze and document:

System Architecture
- Overall application architecture
- Backend architecture
- Frontend architecture
- Database architecture
- Deployment and infrastructure architecture
- Environment strategy

Application Domains
- Authentication and authorization architecture
- Booking lifecycle
- Payment lifecycle
- Refund lifecycle
- Notification lifecycle
- Reporting lifecycle
- Audit logging lifecycle
- Monitoring lifecycle
- Administrative workflows

Technical Architecture
- Controllers, services, repositories, serializers, validators, middleware
- Background jobs, event flows, scheduled processes
- Shared utilities, error handling, configuration management

Repository Standards
- Coding conventions, folder conventions, dependency management
- Testing patterns, documentation standards, API standards

Audit all payment-related assets within: server/, web/, scripts, configuration, environment definitions, database schemas, migrations, API contracts, Postman collections, documentation, and operational tooling.

Deliverable

Repository Audit Report including architecture overview, domain overview, dependency map, payment-related inventory, architectural observations, risks discovered, open questions, and validation requirements.

Do not proceed until the repository audit is complete.

======================================================================
PHASE 2 — DOCUMENTATION AUDIT
======================================================================

Objective

Establish a complete understanding of all documented business rules, architecture decisions, operational procedures, workflows, and constraints.

Mandatory Scope

Read and analyze every document under docs/ and all nested directories, including docs/README.md, docs/ai/, docs/adrs/, docs/research/, docs/reports/, and any architecture, API, business-rule, workflow, maintenance, operational, technical, implementation-status, or decision-history documentation.

Requirements
- Do not skip documents based on filenames.
- Review every ADR and treat ADRs as binding architectural constraints unless explicitly superseded.
- Cross-reference documentation against actual implementation.

Develop a complete understanding of: booking lifecycle (creation, holds, expiration), payment lifecycle, refund lifecycle, reconciliation lifecycle, callback and webhook flows, notification workflows, administrative workflows, reporting workflows, business rules, validation rules, security requirements, operational requirements, state transitions, technical constraints, and repository conventions.

Deliverable

Documentation Audit Summary including documents reviewed, key findings per document, business/technical/architectural/operational requirements, constraints, assumptions requiring validation, documentation gaps, documentation inconsistencies, and repository/documentation mismatches.

Do not proceed until documentation analysis is complete.

======================================================================
PHASE 3 — PAYMENT DOMAIN ANALYSIS
======================================================================

Objective

Create a complete model of the payment domain before designing the PhonePe integration.

Analyze and document:

Booking Workflows
- Creation, hold, confirmation, expiration, cancellation

Payment Workflows
- Initiation, processing, success, failure, timeout, cancellation

Refund Workflows
- Initiation, processing, completion, failure

Operational Workflows
- Callback handling, redirect handling, webhook handling, reconciliation, notification triggering, administrative payment operations

For every workflow, document: business rules, state transitions, triggering events, API interactions, database interactions, dependencies, validation rules, error handling, recovery mechanisms, security requirements, and audit requirements.

Deliverable

Payment Domain Analysis Document containing the current-state domain model, workflow diagrams, state transition maps, dependency maps, business-rule inventory, and operational requirements.

No implementation work may begin until this phase is complete.

======================================================================
PHASE 4 — EXISTING PAYMENT SYSTEM AUDIT
======================================================================

Objective

Identify all payment-related implementations and determine their future disposition.

Audit: database structures, schemas, models, entities, services, repositories, controllers, APIs, webhook handlers, scheduled jobs, background workers, frontend payment flows, admin payment functionality, status management, test utilities, seed data, documentation, scripts, environment variables, feature flags, and temporary workarounds.

For each component, classify as: Production-Ready, Temporary, Deprecated, Retain, Remove, Refactor, or Replace.

Deliverable

Payment System Audit Report including current implementation inventory, purpose of each component, architectural assessment, removal candidates, refactor candidates, and retention candidates.

No code changes during this phase.

======================================================================
PHASE 5 — PHONEPE AND HOOKDECK RESEARCH
======================================================================

Objective

Research and validate everything required for a production-grade PhonePe PG integration using only official sources.

Research and validate: official PhonePe PG documentation, authentication mechanisms, merchant onboarding requirements, sandbox and production environment requirements, payment/status/refund APIs, callback and redirect flows, webhook specifications, security requirements, signature generation and verification, checksum requirements, idempotency requirements, rate limits, error codes, compliance requirements, settlement workflows, retry mechanisms, failure handling, recovery strategies, reconciliation requirements, and monitoring requirements.

Use Hookdeck as the standard webhook-forwarding solution for local development. Document installation, authentication, configuration, forwarding setup, delivery inspection, event replay, troubleshooting, and security considerations, with validated commands and examples.

Deliverable

docs/research/PHONEPE-PG-INTEGRATION-RESEARCH.md — this document becomes the single source of truth for implementation and must include official references, architecture recommendations, security requirements, API specifications, request/response structures, flow and state-transition diagrams, failure and recovery strategies, reconciliation requirements, testing requirements, Hookdeck/sandbox/production setup guides, operational guidance, monitoring requirements, known limitations, and known constraints.

No implementation work may begin until this document is complete and validated.

======================================================================
PHASE 6 — GAP ANALYSIS
======================================================================

Objective

Using the repository audit, documentation audit, payment domain analysis, payment-system audit, and PhonePe/Hookdeck research, identify missing functionality, missing infrastructure, missing security controls, missing workflows, missing APIs, missing database structures, missing operational capabilities, missing observability, and missing resilience mechanisms, along with technical, business, and architectural risks and assumptions requiring validation.

Deliverable

Gap Analysis Report.

======================================================================
PHASE 7 — TARGET-STATE ARCHITECTURE DESIGN
======================================================================

Objective

Design the complete target-state PhonePe payment architecture.

Define:

Payment Architecture
- Payment lifecycle, refund, and reconciliation architecture
- Database, API, service, and repository architecture
- Webhook, callback, and redirect architecture

Security Architecture
- Signature generation and verification
- Idempotency and replay protection
- Fraud prevention controls
- Authorization boundaries

Operational Architecture
- Monitoring, logging, alerting, audit logging, observability, failure recovery

Frontend Architecture
- Payment initiation UX, redirect UX, status synchronization, failure handling UX

Deliverable

Architecture decision log, architecture diagrams, sequence diagrams, data-flow diagrams, and state-transition diagrams. Every decision must include rationale and must be validated against ADRs and repository constraints. Identify whether new ADRs are required.

======================================================================
PHASE 8 — IMPLEMENTATION PLAN
======================================================================

Objective

Produce an execution-ready implementation plan.

Include: scope, workstreams, dependencies, milestones, execution sequence, database changes, API changes, frontend changes, security controls, documentation changes, testing requirements, cleanup requirements, validation checkpoints, and risk mitigation strategies.

The plan must be detailed enough for direct implementation without ambiguity.

======================================================================
PHASE 9 — ARCHITECTURE VALIDATION REVIEW
======================================================================

Validate the proposed architecture and implementation plan against business rules, booking workflows, existing API contracts, existing database design, ADRs, documentation, repository conventions, security requirements, and operational requirements.

Identify conflicts, gaps, risks, and ambiguities. Resolve all findings before implementation begins.

Deliverable

Validation Review Report.

======================================================================
PHASE 10 — PAYMENT CLEANUP EXECUTION
======================================================================

After architecture approval, remove obsolete payment implementations.

Cleanup scope: code, schemas, APIs, documentation, scripts, configurations, tests, and environment variables.

Remove: mock payment systems, placeholder payment systems, simulated payment engines, temporary payment workflows, and obsolete payment code.

Only retain components justified by documented business requirements.

======================================================================
PHASE 11 — PHONEPE IMPLEMENTATION
======================================================================

Implement the approved architecture.

Backend Scope
- Database updates, domain models, repositories, services, controllers, serializers, validators
- API contracts, payment initiation, status synchronization
- Callback handling, redirect handling, webhook processing
- Refund processing, reconciliation, audit logging, monitoring, observability

Security Scope
- Signature generation and verification
- Idempotency controls, replay protection
- Input validation, authorization controls
- Error handling, recovery mechanisms

Frontend Scope
- Payment experience, redirect experience, status handling
- Error handling, recovery UX, administrative payment views

Implementation Requirements
- Follow repository patterns, ADRs, approved architecture, and the implementation plan
- Maintain code quality standards throughout

======================================================================
PHASE 12 — DOCUMENTATION SYNCHRONIZATION
======================================================================

Update all impacted documentation, including docs/ai/, docs/adrs/, docs/research/, docs/reports/, llms.txt, server/scripts/, server/postman/, and all architecture, API, business-rule, operational, and testing documentation.

Ensure documentation exactly reflects the final implementation.

======================================================================
PHASE 13 — COMPREHENSIVE TESTING
======================================================================

Create and execute:

Unit Tests
- Domain tests, service tests, repository tests, controller tests

Integration Tests
- API tests, webhook tests, refund tests, reconciliation tests

End-to-End Tests
- Booking-payment flow, success flow, failure flow, refund flow

Reliability Tests
- Retry handling, timeout handling, duplicate webhook handling
- Idempotency validation, concurrency validation, race-condition validation
- Network interruption handling, recovery validation

Security Tests
- Signature verification, authorization enforcement
- Replay attack protection, invalid payload handling

All tests must pass. Resolve all failures before proceeding.

======================================================================
PHASE 14 — PRODUCTION READINESS REVIEW
======================================================================

Perform a complete production readiness assessment.

Validate: security readiness, operational readiness, monitoring readiness, observability readiness, reliability readiness, performance readiness, scalability readiness, documentation readiness, testing readiness, recovery readiness, and support readiness.

Document findings and resolve all critical and high-severity deficiencies.

======================================================================
PHASE 15 — FINAL VALIDATION AND IMPLEMENTATION REPORT
======================================================================

Perform a complete final review.

Verify: business requirements satisfied, architecture consistency, documentation completeness, API accuracy, database correctness, security implementation completeness, testing completeness, cleanup completeness, monitoring functionality, PhonePe functionality, and operational readiness.

Deliverable

Final Implementation Report containing an executive summary, work completed, architecture implemented, components modified, components removed, documentation updated, tests executed, risks mitigated, operational guidance, and outstanding non-blocking considerations.

MANDATORY QUALITY GATES BEFORE COMPLETION

Do not declare completion until all of the following are satisfied:
- Repository audit completed
- Documentation audit completed
- Payment domain analysis completed
- Existing payment audit completed
- PhonePe and Hookdeck research completed
- Gap analysis completed
- Architecture approved
- Implementation plan approved
- Validation review passed
- Cleanup completed
- PhonePe integration implemented
- Documentation synchronized
- All tests passing
- Production readiness review passed
- Final validation passed

ENGINEERING STANDARDS

All delivered code must be production-grade, secure, reliable, maintainable, extensible, observable, and scalable, and must be consistent with repository conventions, ADRs, and documented business rules.

All outputs must demonstrate deep analysis, evidence-based reasoning, architectural rigor, security awareness, operational readiness, thorough validation, and complete traceability from requirement to implementation.