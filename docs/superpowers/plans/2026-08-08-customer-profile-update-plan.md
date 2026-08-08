# Customer Self-Service Profile Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an authenticated, validated, self-service customer profile name update through `PATCH /users/me` and a responsive `/dashboard/profile` page.

**Architecture:** Extend the existing `users` module with a PATCH route that reuses the onboarding name rules, authenticates via the existing JWT/session middleware, enforces onboarding completion, and persists through the existing repository/service boundary. Add a route-independent frontend Server Action and a dashboard page that reuse `verifySession`, the typed action result contract, shared dashboard form primitives, and the existing sidebar shell. Keep the onboarding `NameForm` focused on first-time setup instead of reusing its auth-oriented composition for account settings. No schema migration is required because the existing `users.name` and `users.onboarding_completed_at` columns already model the state.

**Tech Stack:** Node.js 20, Express 5, Joi, Prisma/PostgreSQL, native `node:test`, Supertest, Next.js 16 App Router, React 19, Server Actions, Zod 4, Tailwind CSS 4.

> **Execution status (2026-08-08):** Implementation, documentation, regression coverage, and verification are complete. The repository intentionally remains uncommitted; final intended changes are staged for review, and no commit or push is part of this execution. The commit steps below remain unchecked as an explicit handoff decision, not as an unfinished feature task.

---

## File map

- Modify `server/src/modules/users/users.validators.js`: centralize the customer-name Joi rule and export the PATCH body schema.
- Modify `server/src/modules/users/users.routes.js`: register `PATCH /me` with authentication, onboarding, and validation middleware.
- Modify `server/src/modules/users/users.controller.js`: add a thin update-profile controller handler.
- Modify `server/src/modules/users/users.service.js`: expose the update-profile service method and return the canonical profile DTO.
- Modify `server/src/modules/users/users.repository.js`: update only the authenticated user’s name while preserving the first completion timestamp and existing profile serialization.
- Modify `server/src/modules/auth/auth.service.js` and `server/src/middleware/require-onboarding.middleware.js`: use the current onboarding completion contract consistently for authentication responses and protected routes.
- Modify `server/tests/integration/user-onboarding-routes.test.js`: add route-level red/green coverage for PATCH success, validation, and onboarding authorization.
- Create `server/tests/unit/users-service.test.js`: cover service delegation and response shape without a database.
- Modify `server/tests/unit/users-repository.test.js`: add repository persistence, timestamp-preservation, and repeat-update coverage using the existing database-backed user fixture.
- Modify `server/src/modules/openapi/openapi.spec.js`: document PATCH request, response, and errors.
- Modify `server/tests/integration/openapi.test.js`: assert PATCH is present and included in built-in route coverage.
- Regenerate `server/postman/users.postman_collection.json`: add the PATCH request from OpenAPI; do not hand-edit generated output.
- Modify `web/src/lib/actions/auth.js`: add a typed, session-verified profile update action with refresh-on-401.
- Create `web/src/components/features/auth/ProfileForm.js`: provide a dashboard-specific account-settings composition, explicit accessible field wiring, client state, and feedback while reusing shared controls and the typed profile Server Action.
- Modify `web/src/components/features/auth/index.js`: export `ProfileForm` through the existing auth component barrel.
- Create `web/src/app/(dashboard)/dashboard/profile/page.js`: render the protected profile page and form state.
- Modify `web/src/components/layout/AppSidebar.js`: add the Profile navigation entry.
- Modify `web/src/lib/rbac.js`: map `/dashboard/profile` to `view_own_bookings`.
- Create `web/tests/profile.test.js`: cover the profile-facing validation contract and route access mapping using the existing native test style.
- Modify `docs/specs/02-API-SPECIFICATION.md`: mark PATCH implemented and define the final response/error contract.
- Modify `docs/ai/02-CODEBASE-MAP.md`: add the profile page/action and PATCH traceability.
- Modify `docs/ai/03-IMPLEMENTATION-STATUS.md`: mark customer self-service profile update complete and resolve the prior divergence.
- Modify `docs/audits/02-DOCUMENTED-FEATURE-IMPLEMENTATION-AUDIT.md`: mark Item 5.1 implemented with final affected files.
- Modify `README.md` and `web/README.md`: reflect the customer profile surface where the existing architecture summaries list dashboard responsibilities.
- Modify `llms.txt`: add the profile route/action to the architecture snapshot.
- Modify `docs/superpowers/specs/2026-08-08-customer-profile-update-design.md` only if implementation findings materially change the approved design; otherwise leave the committed design unchanged.

### Task 1: Add failing backend route and service contract tests

**Files:**
- Modify `server/tests/integration/user-onboarding-routes.test.js`
- Create `server/tests/unit/users-service.test.js`

- [x] **Step 1: Write the failing PATCH integration tests**

Update the existing `createTestApp` helper to accept an optional injected onboarding middleware before adding the tests:

```js
function createTestApp(userService, { onboardingMiddleware = (_req, _res, next) => next() } = {}) {
  const authService = {
    sendCustomerOtp: async () => ({}),
    verifyCustomerOtp: async () => ({}),
    refreshSession: async () => ({}),
    logoutCurrent: async () => {},
    logoutAll: async () => {},
  };

  return createApp({
    configOverrides: { auth: { accessTokenSecret: secret } },
    configureRoutes(router) {
      router.use('/auth', createAuthRouter({ authService, userService }));
      router.use('/users', createUsersRouter({ userService, onboardingMiddleware }));
    },
  });
}
```

Then add tests to `user-onboarding-routes.test.js`:

```js
test('PATCH /users/me updates the authenticated user profile', async () => {
  const app = createTestApp({
    updateProfile: async ({ userId, name }) => ({
      id: userId,
      phone: '+919876543210',
      name,
      onboarding_complete: true,
      roles: [],
      permissions: ['view_own_bookings'],
    }),
  });

  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '  Asha   Mehta  ' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.name, 'Asha Mehta');
  assert.equal(response.body.data.id, 'user-1');
});

test('PATCH /users/me rejects unsupported or invalid profile payloads', async () => {
  const app = createTestApp({ updateProfile: async () => { throw new Error('must not call service'); } });

  const missingName = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(missingName.status, 400);

  const unknownField = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Asha Mehta', phone: '+919876543210' });
  assert.equal(unknownField.status, 400);
});

test('PATCH /users/me requires onboarding completion', async () => {
  const app = createTestApp(
    { updateProfile: async () => ({ name: 'Asha Mehta' }) },
    { onboardingMiddleware: (_req, _res, next) => next(new ForbiddenError('Onboarding incomplete', { code: 'ONBOARDING_INCOMPLETE' })) },
  );

  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Asha Mehta' });

  assert.equal(response.status, 403);
  assert.equal(response.body.data.code, 'ONBOARDING_INCOMPLETE');
});
```

Import `ForbiddenError` at the top of the test file and keep the middleware injection separate from the user-service stub so the route test exercises authorization before service execution.

- [x] **Step 2: Run the focused integration test and verify the expected RED failure**

Run from `server/`:

```powershell
npm test -- --test-name-pattern="PATCH /users/me"
```

Expected: the tests fail because `PATCH /api/v1/users/me` is currently unmatched (404) or the test app has no `updateProfile` route handler. Do not change production code until this failure is observed.

- [x] **Step 3: Write the failing service contract tests**

Create `server/tests/unit/users-service.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsersService } from '../../src/modules/users/users.service.js';

test('updateProfile delegates the authenticated user and normalized name to the repository', async () => {
  const calls = [];
  const repository = {
    updateProfile: async (input) => {
      calls.push(input);
      return {
        id: 'user-1',
        phone: '+919876543210',
        name: input.name,
        onboarding_complete: true,
        roles: [],
        permissions: ['view_own_bookings'],
      };
    },
  };

  const result = await createUsersService({ repository }).updateProfile({
    userId: 'user-1',
    name: 'Asha Mehta',
  });

  assert.deepEqual(calls, [{ userId: 'user-1', name: 'Asha Mehta' }]);
  assert.equal(result.name, 'Asha Mehta');
  assert.deepEqual(result.permissions, ['view_own_bookings']);
});
```

- [x] **Step 4: Run the service test and verify it fails because the method is absent**

Run:

```powershell
npm test -- --test-name-pattern="updateProfile"
```

Expected: FAIL with `updateProfile is not a function`.

- [ ] **Step 5: Commit the red tests** *(Intentionally not run; the repository remains uncommitted.)*

```powershell
git add server/tests/integration/user-onboarding-routes.test.js server/tests/unit/users-service.test.js
git commit -m "test: specify customer profile update contract"
```

### Task 2: Implement the backend profile update flow

**Files:**
- Modify `server/src/modules/users/users.validators.js`
- Modify `server/src/modules/users/users.routes.js`
- Modify `server/src/modules/users/users.controller.js`
- Modify `server/src/modules/users/users.service.js`
- Modify `server/src/modules/users/users.repository.js`

- [x] **Step 1: Add a shared Joi name rule and profile schema**

In `users.validators.js`, define one reusable rule and use it for onboarding and PATCH:

```js
const customerNameSchema = Joi.string().trim().replace(/\s+/g, ' ').min(2).max(100);

export const onboardingSchema = Joi.object({
  name: customerNameSchema.required(),
});

export const profileUpdateSchema = Joi.object({
  name: customerNameSchema.required(),
});
```

Keep the existing `myBookingsQuerySchema` unchanged and preserve `allowUnknown: false` through the existing validation middleware.

- [x] **Step 2: Register the protected route**

Import `profileUpdateSchema` and add this route before the `/me/bookings` route in `createUsersRouter`:

```js
router.patch(
  '/me',
  authMiddleware,
  onboardingMiddleware,
  validate(profileUpdateSchema),
  controller.updateProfile,
);
```

The injected middleware defaults must remain testable; do not hard-code a new `authenticate()` or `requireOnboarding()` call inside the route factory.

- [x] **Step 3: Add controller and service methods**

Add the controller handler:

```js
updateProfile: asyncHandler(async (req, res) => {
  const user = await userService.updateProfile({
    userId: req.auth.subject,
    name: req.validated.body.name,
  });
  res.json(ApiResponse.success(user, 'Profile updated'));
}),
```

Add the service method:

```js
async updateProfile({ userId, name }) {
  return repository.updateProfile({ userId, name });
},
```

Keep the response as the canonical `UserProfile` shape so frontend session reads and PATCH responses share one contract.

- [x] **Step 4: Implement repository persistence with timestamp preservation**

Refactor the existing transactional name update into a private helper or a focused shared repository function so both onboarding and profile updates preserve the same behavior. The profile path must:

```js
const existing = await tx.user.findUnique({ where: { id: userId } });
if (!existing) throw new NotFoundError('User not found');

const user = await tx.user.update({
  where: { id: userId },
  data: {
    name,
    onboardingCompletedAt: existing.onboardingCompletedAt || new Date(),
  },
  include: includeUserAuthContext,
});

return serializeAuthProfile(user);
```

Retain the existing `P2025` translation. Do not alter phone, verification, wallet, roles, permissions, or any other user field. Keep the timestamp unchanged after onboarding is already complete.

Add a nested repository test for the existing fixture that records the user’s original `onboardingCompletedAt`, updates the name twice, and asserts both updates target the same user while the original completion timestamp remains unchanged.

- [x] **Step 5: Run focused backend tests and verify GREEN**

Run:

```powershell
npm test -- --test-name-pattern="PATCH /users/me|updateProfile"
```

Expected: all focused route/service tests pass with no failures.

- [x] **Step 6: Refactor only after GREEN and run the focused tests again**

Remove any duplication introduced between `completeOnboarding` and `updateProfile` while preserving public method names. Run the same command and expect the same passing result.

- [ ] **Step 7: Commit the backend implementation** *(Intentionally not run; the repository remains uncommitted.)*

```powershell
git add server/src/modules/users server/tests/integration/user-onboarding-routes.test.js server/tests/unit/users-service.test.js
git commit -m "feat: add customer profile update API"
```

### Task 3: Synchronize OpenAPI, route coverage, and Postman

**Files:**
- Modify `server/src/modules/openapi/openapi.spec.js`
- Modify `server/tests/integration/openapi.test.js`
- Regenerate `server/postman/users.postman_collection.json`

- [x] **Step 1: Add the failing OpenAPI assertions**

Update the existing OpenAPI integration tests to assert:

```js
assert.ok(response.body.paths['/users/me'].patch);
assert.equal(response.body.paths['/users/me'].patch.requestBody.required, true);
assert.ok(response.body.paths['/users/me'].patch.responses['400']);
assert.ok(response.body.paths['/users/me'].patch.responses['403']);
```

Add `'PATCH /api/v1/users/me'` to the built-in route inventory.

- [x] **Step 2: Run the OpenAPI test and verify RED**

Run from `server/`:

```powershell
npm test -- --test-name-pattern="OpenAPI"
```

Expected: FAIL because the operation is not currently present in `openapi.spec.js`.

- [x] **Step 3: Document the PATCH operation**

Add a `patch` operation under the existing `paths['/users/me']` object with:

- tag `Users`;
- summary `Update current user profile`;
- bearer security;
- required JSON `name` string with example `Asha Mehta`, `minLength: 2`, `maxLength: 100`;
- `200` response using `UserProfile`;
- `400`, `401`, and `403` responses using the existing `ApiError` schema.

- [x] **Step 4: Run OpenAPI tests and regenerate Postman**

Run:

```powershell
npm test -- --test-name-pattern="OpenAPI"
npm run postman:generate
```

Expected: OpenAPI tests pass and `server/postman/users.postman_collection.json` contains a `PATCH /api/v1/users/me` request with bearer auth and a `{ "name": "Asha Mehta" }` body.

- [ ] **Step 5: Commit contract artifacts** *(Intentionally not run; the repository remains uncommitted.)*

```powershell
git add server/src/modules/openapi/openapi.spec.js server/tests/integration/openapi.test.js server/postman/users.postman_collection.json
git commit -m "docs: publish profile update API contract"
```

### Task 4: Add the frontend action and profile page

**Files:**
- Modify `web/src/lib/actions/auth.js`
- Create `web/src/components/features/auth/ProfileForm.js`
- Create `web/src/app/(dashboard)/dashboard/profile/page.js`
- Modify `web/src/components/layout/AppSidebar.js`
- Modify `web/src/lib/rbac.js`
- Create `web/tests/profile.test.js`

- [x] **Step 1: Add failing frontend route/validation tests**

Create `web/tests/profile.test.js` using the existing node:test style:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { nameSchema } from '../src/lib/schemas/index.js';
import { canAccessRoute } from '../src/lib/rbac.js';

test('profile route is available to customers with the existing dashboard permission', () => {
  assert.equal(canAccessRoute('/dashboard/profile', 'customer'), true);
});

test('profile names use the same normalization and validation as onboarding', () => {
  const parsed = nameSchema.safeParse('  Asha   Mehta  ');
  assert.equal(parsed.success, true);
  assert.equal(parsed.data, 'Asha Mehta');
  assert.equal(nameSchema.safeParse('A').success, false);
});
```

- [x] **Step 2: Run the focused frontend test and verify RED**

Run from `web/`:

```powershell
node --test tests/profile.test.js
```

Expected: FAIL because `/dashboard/profile` is not mapped in `routeAccess`.

- [x] **Step 3: Implement the profile Server Action**

Add to `web/src/lib/actions/auth.js`:

```js
export async function updateProfileAction(name) {
  const session = await verifySession();
  if (!session?.user) {
    return fail(null, {
      code: 'unauthorized',
      status: 401,
      message: 'Your session has expired. Please sign in again.',
    });
  }

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return fail(null, { code: 'bad_request', message: parsed.error.issues[0]?.message });
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || '';
    const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || '';
    const { payload } = await apiRequest('/api/v1/users/me', {
      method: 'PATCH',
      body: { name: parsed.data },
      accessToken,
      refreshToken,
      retryOnUnauthorized: true,
    });

    return ok(payload.data);
  } catch (error) {
    return fail(error);
  }
}
```

Import `verifySession` from the existing session DAL. If the refresh-on-401 path returns a newly persisted access token internally, preserve the existing action/transport behavior; do not introduce browser storage or a second HTTP client.

- [x] **Step 4: Build the dashboard-styled profile form with shared controls**

Create `ProfileForm.js` as a client component that imports `updateProfileAction`, owns the editable name, loading, validation, success, and server-error state, and composes the shared `Input`, `Button`, `Card`, and `FormAlert` controls with profile-local label, description, and field-error markup in the dashboard visual language. The profile success path should show an inline success alert, update the displayed canonical name, refresh the server-rendered sidebar session, and leave the user on `/dashboard/profile`. The submit button must disable during the request. Validation and server failures must remain visible with `role="alert"` through the existing alert primitives. Keep `NameForm` responsible for first-time onboarding only and leave the shared `FormField` implementation stable; the profile editor should not reuse the centered auth presentation.

- [x] **Step 5: Add the protected dashboard page and navigation**

Create `dashboard/profile/page.js` as a server component:

```js
import { requireRouteAccess } from '@/lib/dal/session';
import { ProfileForm } from '@/components/features/auth';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const session = await requireRouteAccess('/dashboard/profile');
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <ProfileForm
        initialName={session.user.name}
      />
    </div>
  );
}
```

Use the project’s established page metadata and route imports as appropriate. Add `/dashboard/profile` to `NAV_LINKS` and `routeAccess` with `view_own_bookings`. Do not add a new permission or alter admin routing.

- [x] **Step 6: Run focused frontend tests, lint, and build**

Run:

```powershell
node --test tests/profile.test.js
npm run lint
npm run build
```

Expected: all focused tests pass, lint exits 0, and the build output includes `/dashboard/profile`.

- [ ] **Step 7: Commit the frontend implementation** *(Intentionally not run; the repository remains uncommitted.)*

```powershell
git add web/src web/tests/profile.test.js
git commit -m "feat: add customer profile page"
```

### Task 5: Update project documentation and traceability

**Files:**
- Modify `docs/specs/02-API-SPECIFICATION.md`
- Modify `docs/ai/02-CODEBASE-MAP.md`
- Modify `docs/ai/03-IMPLEMENTATION-STATUS.md`
- Modify `docs/audits/02-DOCUMENTED-FEATURE-IMPLEMENTATION-AUDIT.md`
- Modify `README.md`
- Modify `web/README.md`
- Modify `llms.txt`

- [x] **Step 1: Update the API specification**

Remove the planned/not-implemented warning from `PATCH /users/me`. Document that it is protected by JWT plus onboarding completion, accepts only `name`, normalizes whitespace, and returns the canonical current-user profile. Document `400` validation, `401` authentication, and `403 ONBOARDING_INCOMPLETE` outcomes.

- [x] **Step 2: Update AI context and audit status**

Change customer self-service profile update from Missing/Planned to Implemented. Record the backend route/controller/service/repository, frontend action/page/navigation, tests, OpenAPI, and generated Postman artifacts. Remove the old divergence note that described the endpoint as unavailable; preserve unrelated planned admin/profile fields as out of scope.

- [x] **Step 3: Update navigation/architecture references**

Add `/dashboard/profile` to the dashboard route lists and mention that customer mutations use the route-independent auth Server Action. Update `llms.txt` only for the new traceability surface; do not rewrite unrelated architecture text.

- [x] **Step 4: Review documentation for consistency**

Run:

```powershell
rg -n "PATCH /users/me|dashboard/profile|Customer Profiles|self-service profile|profile update" docs README.md web/README.md llms.txt
```

Expected: no authoritative document still calls the implemented PATCH endpoint missing or unimplemented, and all references use `/auth/onboarding` for first-time setup and `/users/me` for post-onboarding edits.

- [ ] **Step 5: Commit documentation** *(Intentionally not run; the repository remains uncommitted.)*

```powershell
git add docs README.md web/README.md llms.txt
git commit -m "docs: record customer profile self-service flow"
```

### Task 6: Full verification and final review

**Files:**
- Inspect all changed files and `git diff`.

- [x] **Step 1: Run all backend tests**

From `server/`:

```powershell
npm test
```

Observed 2026-08-08: 269 tests passed with 0 failures.

- [x] **Step 2: Run all frontend tests**

From `web/`:

```powershell
npm test
```

Observed 2026-08-08: 99 tests passed with 0 failures.

- [x] **Step 3: Run frontend quality gates**

From `web/`:

```powershell
npm run lint
npm run build
```

Observed 2026-08-08: frontend lint and production build both exited 0; the build listed `/dashboard/profile`.

- [x] **Step 4: Run targeted route/security checks**

From `server/`:

```powershell
npm test -- --test-name-pattern="PATCH /users/me|OpenAPI|onboarding"
```

Observed 2026-08-08: the focused auth, onboarding, repository, and profile-update coverage passed; the complete backend suite also passed with 269 tests and 0 failures. Missing/invalid body, unknown field, absent JWT, onboarding-incomplete, and timestamp-preservation cases are covered.

- [x] **Step 5: Inspect the final diff and status**

Run:

```powershell
git diff --check
git status --short
git log --oneline -6
```

Confirm there are no generated dependency directories, secrets, unrelated refactors, dead route entries, stale API warnings, or accidental edits outside the approved file map.

- [x] **Step 6: Review the final requirements checklist before claiming completion**

Confirm:

- PATCH route, controller, service, repository, validation, and tests exist.
- Authentication and onboarding authorization are enforced server-side.
- Only the authenticated user’s name is updated; the completion timestamp is preserved.
- Frontend profile page is reachable from the customer dashboard and works on mobile/desktop with accessible feedback states.
- OpenAPI, Postman, audit, AI context, README, and `llms.txt` references match the final behavior.
- Full backend/frontend tests and frontend quality gates have fresh passing evidence.
