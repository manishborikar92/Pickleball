import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Permissions } from '../../src/shared/auth-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Permission catalog seed alignment: all permission keys in seed.mjs exist in runtime Permissions enum', () => {
  // 1. Locate seed.mjs
  const seedPath = path.resolve(__dirname, '../../prisma/seed.mjs');
  const seedContent = fs.readFileSync(seedPath, 'utf8');

  // 2. Parse the permissions array using a regular expression
  // Match: const permissions = [ ... ];
  const match = seedContent.match(/const\s+permissions\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'Failed to locate permissions array in seed.mjs');

  const permissionsBlock = match[1];
  // Extract all single/double-quoted strings that start elements: e.g. ['manage_courts', '...']
  const keyRegex = /(?:'|")([a-zA-Z_0-9]+)(?:'|")\s*,\s*(?:'|")/g;
  const seedKeys = [];
  let keyMatch;
  while ((keyMatch = keyRegex.exec(permissionsBlock)) !== null) {
    seedKeys.push(keyMatch[1]);
  }

  assert.ok(seedKeys.length > 0, 'No permission keys parsed from seed.mjs');

  // 3. Collect all runtime Permission enum values
  const runtimeValues = new Set(Object.values(Permissions));

  // 4. Assert that every key seeded in seed.mjs is present in the runtime constants
  for (const key of seedKeys) {
    assert.ok(
      runtimeValues.has(key),
      `Seeded permission key "${key}" is missing from the runtime Permissions catalogue. Please update src/shared/auth-constants.js.`
    );
  }

  // 5. Assert that every runtime constant value is represented in the seed array
  const seedKeySet = new Set(seedKeys);
  for (const value of runtimeValues) {
    assert.ok(
      seedKeySet.has(value),
      `Runtime Permission constant value "${value}" is missing from database seed.mjs.`
    );
  }
});
