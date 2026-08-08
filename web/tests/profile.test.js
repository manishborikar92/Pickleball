import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { canAccessRoute } from "../src/lib/rbac.js";
import { nameSchema } from "../src/lib/schemas/index.js";

const profilePageSource = readFileSync(
  fileURLToPath(new URL("../src/app/(dashboard)/dashboard/profile/page.js", import.meta.url)),
  "utf8",
);
const profileFormSource = readFileSync(
  fileURLToPath(new URL("../src/components/features/auth/ProfileForm.js", import.meta.url)),
  "utf8",
);

test("customer profile route is available to authenticated customers", () => {
  assert.equal(canAccessRoute("/dashboard/profile", "customer"), true);
  assert.equal(canAccessRoute("/dashboard/profile", null), false);
});

test("profile name validation matches the onboarding normalization rules", () => {
  assert.equal(nameSchema.parse("  Asha   Mehta  "), "Asha Mehta");
  assert.equal(nameSchema.safeParse("A").success, false);
  assert.equal(nameSchema.safeParse(" ").success, false);
});

test("profile page follows the dashboard shell conventions", () => {
  assert.match(profilePageSource, /SectionHeader/);
  assert.match(profilePageSource, /overflow-y-auto/);
  assert.match(profilePageSource, /session\.user\.phone/);
});

test("profile form uses a dashboard-specific composition and refreshes session UI", () => {
  assert.doesNotMatch(profileFormSource, /NameForm/);
  assert.match(profileFormSource, /router\.refresh\(\)/);
  assert.match(profileFormSource, /id=\"profile-name\"/);
  assert.match(profileFormSource, /profile-name-help profile-name-error/);
});

test("profile form owns its field associations without changing shared form primitives", () => {
  assert.doesNotMatch(profileFormSource, /FormField/);
  assert.match(profileFormSource, /<label htmlFor=\"profile-name\"/);
  assert.match(profileFormSource, /<p id=\"profile-name-error\"/);
  assert.match(profileFormSource, /aria-required=\"true\"/);
});
