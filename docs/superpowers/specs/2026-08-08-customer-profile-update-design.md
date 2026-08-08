# Customer Self-Service Profile Update — Design

## Context and current-state findings

The platform already stores the customer profile in `users.name`; no other
self-service profile fields exist in the Prisma model or API contract. The
current onboarding flow sets `users.name` and `onboarding_completed_at`
together. The completion timestamp is the runtime completion signal, and
profile updates preserve it.

The existing backend follows a module boundary of route → Joi validation →
controller → service → Prisma repository. `GET /users/me` is mounted under
`/users`, while first-time name collection is deliberately mounted under
`/auth/onboarding`. The existing onboarding repository operation is
transactional and idempotent. The new endpoint should extend this module
without introducing a second profile abstraction or changing the onboarding
route.

The web application uses server-rendered dashboard pages, a route-independent
Server Action layer for mutations, a DAL session boundary, Zod schemas shared
between form UX and actions, and reusable shared form controls. The onboarding
`NameForm` remains focused on first-time setup; the profile page uses a
dashboard-specific composition so account settings match the surrounding
dashboard shell and visual language.

## Requirements and invariants

- Expose `PATCH /api/v1/users/me`.
- Require a valid authenticated JWT/session and onboarding completion.
- Accept exactly `{ "name": string }`; reject unknown fields, missing fields,
  blank names, names shorter than 2 characters, and names longer than 100
  characters.
- Normalize leading/trailing whitespace and collapse internal whitespace, as
  onboarding already does.
- Update only the authenticated subject’s `users.name`.
- Preserve `onboarding_completed_at` once set; do not reset or move it during a
  later profile edit.
- Return the canonical serialized user profile, including current roles and
  permissions, using the same shape as `GET /users/me`.
- Treat repeated identical updates as successful and safe (idempotent in
  resulting state). Concurrent edits use the database’s normal last-write-wins
  semantics; no new version column is justified by the current contract.
- Do not add a database migration or external integration.
- Add a customer-facing `/dashboard/profile` page with accessible, responsive
  edit behavior, loading/disabled, success, validation, and server-error
  states.

## Recommended architecture and data flow

1. `users.validators.js` exports a shared customer-name schema and a
   `profileUpdateSchema`; onboarding reuses the same name rule.
2. `users.routes.js` adds `PATCH /me` after authentication and the existing
   onboarding middleware, then applies `validate(profileUpdateSchema)`.
3. `users.controller.js` forwards the authenticated subject and validated name
   to a service method.
4. `users.service.js` delegates to a repository update and returns the
   canonical profile DTO.
5. `users.repository.js` performs the update in the existing transactional
   profile-update pattern, preserving the original completion timestamp and
   translating missing users to the existing `NotFoundError` contract.
6. OpenAPI documents the PATCH operation, and Postman is regenerated from the
   OpenAPI source so the request contract stays synchronized.
7. `web/src/lib/actions/auth.js` gains a profile-update Server Action that
   reuses `nameSchema`, verifies the real session, forwards both cookies with
   refresh-on-401, and keeps the profile state server-authoritative without
   storing profile data in browser storage.
8. `web/src/app/(dashboard)/dashboard/profile/page.js` verifies the dashboard
   session and renders a focused profile form. The form uses the shared name
   schema, stable `Input`, `Button`, `Card`, and `FormAlert` controls plus
   profile-local label and error markup in a dashboard-specific layout. The
   action result drives success and failure feedback and refreshes the
   server-rendered sidebar session. The onboarding `NameForm` and shared
   `FormField` implementation remain unchanged. `AppSidebar` adds the Profile
   entry and `rbac.js` maps the route to the existing `view_own_bookings`
   permission.

## API design review decision

The new route is preserved as `/users/me` because it is already the documented
self-resource URI, matches `GET /users/me`, and avoids an incompatible rename.
`PATCH` is the correct partial-update method for the supported name field.
The existing `/auth/onboarding` route remains intentionally separate because
it represents an authentication/onboarding state transition, not a general
profile resource. The broader `/admin/...` design concerns documented in the
repository are outside this feature and are not changed here; existing ADRs
already establish that authorization is a permission concern and that domain
modules should own their REST surfaces.

## Error handling and security

- Authentication failures remain centralized as `401` errors.
- Unonboarded callers receive the existing `403 ONBOARDING_INCOMPLETE` response.
- Joi/Zod validation failures remain `400` with field-level backend details or
  typed frontend action errors.
- The route uses `req.auth.subject` only; no user ID is accepted from the
  request body or URL, preventing IDOR.
- Unknown payload keys are rejected before service execution.
- Names are never logged; existing request logging and redaction remain
  unchanged.
- `onboarding_complete` is derived from the current completion timestamp, and
  `requireOnboarding` requires both that timestamp and a profile name. Only
  the current completion state is supported.

## Testing strategy

- Backend route integration tests cover authenticated success, normalization,
  validation failures, onboarding authorization, and response shape.
- Backend service/repository tests cover delegation, timestamp preservation,
  missing-user behavior, and idempotent repeat updates where the current test
  seam supports it.
- OpenAPI route coverage asserts the new PATCH operation and the built-in-route
  inventory.
- Frontend native tests cover shared name validation and profile action/result
  behavior at the pure logic boundary available in this repository.
- Run the complete backend test suite, frontend test suite, frontend lint, and
  frontend production build after implementation.

## Documentation impact

Update the API specification, AI implementation status, AI codebase map,
end-user gap audit, root and app documentation where the profile capability is
described, the OpenAPI source, and generated Postman users collection. No
database schema or operational/deployment configuration changes are needed.
