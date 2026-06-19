/* eslint-disable no-console */
/**
 * generate-token-secrets.mjs
 *
 * Generates cryptographically secure JWT secrets for EverCut's three token
 * types (access, refresh, onboarding) using Node.js's built-in crypto module.
 * Zero external dependencies.
 *
 * Security properties of generated secrets:
 *   - Source:   crypto.randomBytes() → CSPRNG (OS-level entropy pool)
 *   - Length:   64 bytes default (512 bits) — exceeds HS256/HS512 requirements
 *   - Encoding: base64url (URL-safe, no padding characters)
 *   - Uniqueness: Each invocation generates three independent, uncorrelated secrets
 *
 * Usage:
 *   node scripts/generate-token-secrets.mjs             # default: print .env block
 *   node scripts/generate-token-secrets.mjs --format=export  # shell export statements
 *   node scripts/generate-token-secrets.mjs --format=raw      # one secret per line
 *   node scripts/generate-token-secrets.mjs --format=json     # JSON object
 *   node scripts/generate-token-secrets.mjs --bytes=96        # 768-bit secrets
 *   node scripts/generate-token-secrets.mjs --check           # audit existing .env secrets
 *   node scripts/generate-token-secrets.mjs --write           # write directly into .env
 *   node scripts/generate-token-secrets.mjs --help
 */

import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ENV_FILE   = resolve(__dirname, '..', '.env');
const MIN_BYTES  = 32;   // 256 bits — absolute floor for production use
const DEF_BYTES  = 64;   // 512 bits — recommended
const MAX_BYTES  = 128;  // 1024 bits — beyond this gives no practical benefit

const TOKEN_SECRETS = [
    {
        envKey:      'JWT_ACCESS_SECRET',
        label:       'Access Token Secret',
        description: 'Signs short-lived access tokens (default TTL: 15 min). Used by authenticate middleware.',
    },
    {
        envKey:      'JWT_REFRESH_SECRET',
        label:       'Refresh Token Secret',
        description: 'Signs long-lived refresh tokens (default TTL: 180 days). Must differ from access secret.',
    },
    {
        envKey:      'JWT_ONBOARDING_SECRET',
        label:       'Onboarding Token Secret',
        description: 'Signs short-lived onboarding tokens (TTL: 24 h). Issued after OTP to new users only. Must differ from both above.',
    },
];

// ---------------------------------------------------------------------------
// ANSI colours (suppressed when not a TTY)
// ---------------------------------------------------------------------------

const isTTY = process.stdout.isTTY;
const c = {
    reset:  isTTY ? '\x1b[0m'  : '',
    bold:   isTTY ? '\x1b[1m'  : '',
    dim:    isTTY ? '\x1b[2m'  : '',
    green:  isTTY ? '\x1b[32m' : '',
    yellow: isTTY ? '\x1b[33m' : '',
    cyan:   isTTY ? '\x1b[36m' : '',
    red:    isTTY ? '\x1b[31m' : '',
    blue:   isTTY ? '\x1b[34m' : '',
};

const bold   = (s) => `${c.bold}${s}${c.reset}`;
const dim    = (s) => `${c.dim}${s}${c.reset}`;
const green  = (s) => `${c.green}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const cyan   = (s) => `${c.cyan}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;
const blue   = (s) => `${c.blue}${s}${c.reset}`;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
    const args = {
        format: 'dotenv',   // dotenv | export | raw | json
        bytes:  DEF_BYTES,
        check:  false,
        write:  false,
        help:   false,
    };

    for (const arg of argv.slice(2)) {
        if (arg === '--help' || arg === '-h') { args.help  = true; continue; }
        if (arg === '--check')                { args.check = true; continue; }
        if (arg === '--write')                { args.write = true; continue; }

        const formatMatch = arg.match(/^--format=(.+)$/);
        if (formatMatch) {
            const f = formatMatch[1].toLowerCase();
            if (!['dotenv', 'export', 'raw', 'json'].includes(f)) {
                bail(`Unknown format "${f}". Valid options: dotenv, export, raw, json`);
            }
            args.format = f;
            continue;
        }

        const bytesMatch = arg.match(/^--bytes=(\d+)$/);
        if (bytesMatch) {
            const b = parseInt(bytesMatch[1], 10);
            if (b < MIN_BYTES) bail(`--bytes must be >= ${MIN_BYTES} (${MIN_BYTES * 8} bits). Using fewer bytes weakens HMAC security.`);
            if (b > MAX_BYTES) bail(`--bytes must be <= ${MAX_BYTES}. Values beyond 1024 bits provide no practical security gain.`);
            args.bytes = b;
            continue;
        }

        bail(`Unknown argument: ${arg}. Run with --help for usage.`);
    }

    return args;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bail = (msg) => {
    console.error(`${red('✖')}  ${msg}`);
    process.exit(1);
};

const generateSecret = (bytes) =>
    crypto.randomBytes(bytes).toString('base64url');

/** Estimate effective entropy in bits (base64url alphabet = 6 bits per char). */
const entropyBits = (bytes) => bytes * 8;

/** Parse a key=value .env file into a Map, preserving order. */
const parseEnvFile = (filePath) => {
    if (!existsSync(filePath)) return new Map();
    const lines = readFileSync(filePath, 'utf8').split('\n');
    const map = new Map();
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
    }
    return map;
};

/** Replace or insert key=value lines in .env, preserving all other content. */
const patchEnvFile = (filePath, patches) => {
    const original = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const lines = original.split('\n');
    const patched = new Set();

    const result = lines.map((line) => {
        const eq = line.indexOf('=');
        if (eq === -1) return line;
        const key = line.slice(0, eq).trim();
        if (patches.has(key)) {
            patched.add(key);
            return `${key}=${patches.get(key)}`;
        }
        return line;
    });

    // Append any keys not already found
    for (const [key, value] of patches) {
        if (!patched.has(key)) {
            result.push(`${key}=${value}`);
        }
    }

    writeFileSync(filePath, result.join('\n'), 'utf8');
};

/** Evaluate strength of an existing secret string. */
const assessSecret = (secret) => {
    if (!secret || secret.trim() === '') return { level: 'missing', color: red };

    const cleaned = secret.replace(/^["']|["']$/g, ''); // strip quotes
    const bytes = Math.floor(cleaned.length * 6 / 8);   // approximate for base64url

    if (cleaned.startsWith('replace_with')) return { level: 'placeholder', color: yellow };
    if (bytes < MIN_BYTES) return { level: `weak (≈${bytes * 8} bits — increase to ≥${MIN_BYTES * 8})`, color: red };
    if (bytes < 48)        return { level: `adequate (≈${bytes * 8} bits)`, color: yellow };
    return { level: `strong (≈${bytes * 8} bits)`, color: green };
};

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

const printHelp = () => {
    console.log(`
${bold('generate-token-secrets.mjs')}
Generates cryptographically secure JWT secrets for EverCut's three token types.

${bold('USAGE')}
  node scripts/generate-token-secrets.mjs [options]

${bold('OPTIONS')}
  ${cyan('--format=<fmt>')}   Output format. One of:
                    ${bold('dotenv')}  (default) — KEY=value block, paste into .env
                    ${bold('export')}  — shell export statements
                    ${bold('raw')}     — one secret per line (pipe-friendly)
                    ${bold('json')}    — JSON object
  ${cyan('--bytes=<n>')}      Secret length in bytes (default: ${DEF_BYTES}, min: ${MIN_BYTES}, max: ${MAX_BYTES})
                    512-bit (64 bytes) is the recommended baseline.
                    Use 96+ for ultra-high-security environments.
  ${cyan('--check')}          Audit existing secrets in .env and report strength.
                    Does not generate new secrets.
  ${cyan('--write')}          Generate new secrets AND write them directly into .env.
                    Existing values are overwritten. Back up .env first.
  ${cyan('--help, -h')}       Show this help message.

${bold('EXAMPLES')}
  # Print ready-to-paste .env block (default)
  node scripts/generate-token-secrets.mjs

  # Print shell export statements
  node scripts/generate-token-secrets.mjs --format=export

  # Generate 768-bit secrets
  node scripts/generate-token-secrets.mjs --bytes=96

  # Audit current .env secrets
  node scripts/generate-token-secrets.mjs --check

  # Generate and write into .env directly (destructive)
  node scripts/generate-token-secrets.mjs --write

${bold('SECURITY NOTES')}
  • Each secret is generated independently via crypto.randomBytes() (OS CSPRNG).
  • Secrets are base64url-encoded: URL-safe, no +/= characters.
  • The three secrets MUST be different — this is verified in --check mode.
  • Never reuse secrets across environments (development / production).
  • Never commit .env to version control.
`);
};

const runCheck = () => {
    console.log(`\n${bold('── JWT Secret Audit ──────────────────────────────────────────────')}\n`);

    if (!existsSync(ENV_FILE)) {
        console.log(`${yellow('⚠')}  .env file not found at ${ENV_FILE}`);
        console.log(`   Run ${cyan('node scripts/generate-token-secrets.mjs --write')} to create initial secrets.\n`);
        return;
    }

    const env = parseEnvFile(ENV_FILE);
    const values = [];

    for (const { envKey, label, description } of TOKEN_SECRETS) {
        const raw = env.get(envKey) || '';
        const { level, color } = assessSecret(raw);
        const masked = raw.length > 12
            ? `${raw.slice(0, 6)}${'*'.repeat(raw.length - 12)}${raw.slice(-6)}`
            : '*'.repeat(raw.length || 8);

        console.log(`${bold(label)}`);
        console.log(`  ${dim('Key:')}         ${envKey}`);
        console.log(`  ${dim('Description:')} ${description}`);
        console.log(`  ${dim('Current:')}     ${dim(masked)}`);
        console.log(`  ${dim('Strength:')}    ${color(level)}`);
        console.log();

        values.push(raw);
    }

    // Uniqueness check
    const unique = new Set(values.filter(Boolean));
    if (unique.size < values.filter(Boolean).length) {
        console.log(`${red('✖')}  ${bold('UNIQUENESS VIOLATION:')} Two or more secrets share the same value.`);
        console.log(`   Each token type MUST use a distinct secret. Run without --check to regenerate.\n`);
    } else if (unique.size === TOKEN_SECRETS.length) {
        console.log(`${green('✔')}  All three secrets are unique.`);
    }

    // Presence check
    const missing = TOKEN_SECRETS.filter(({ envKey }) => !env.get(envKey) || env.get(envKey).trim() === '');
    if (missing.length > 0) {
        console.log(`${yellow('⚠')}  Missing: ${missing.map((s) => s.envKey).join(', ')}`);
        console.log(`   Run ${cyan('node scripts/generate-token-secrets.mjs --write')} to add them.\n`);
    }

    console.log();
};

const generate = (args) => {
    const { format, bytes, write } = args;
    const entropy = entropyBits(bytes);

    // Generate three independent secrets
    const secrets = TOKEN_SECRETS.map(({ envKey, label }) => ({
        envKey,
        label,
        value: generateSecret(bytes),
    }));

    // Uniqueness is mathematically guaranteed at 512 bits, but verify anyway
    const values = secrets.map((s) => s.value);
    const uniqueCount = new Set(values).size;
    if (uniqueCount !== secrets.length) {
        // Astronomically unlikely; bail loudly if it somehow occurs
        bail('CSPRNG collision detected (impossible under normal conditions). Please report this bug.');
    }

    // ── Write mode ────────────────────────────────────────────────────────
    if (write) {
        const patches = new Map(secrets.map(({ envKey, value }) => [envKey, value]));

        if (!existsSync(ENV_FILE)) {
            console.log(`${yellow('⚠')}  .env not found — creating a new one at:\n   ${ENV_FILE}\n`);
        }

        patchEnvFile(ENV_FILE, patches);

        console.log(`\n${green('✔')}  ${bold('Secrets written to .env')}`);
        console.log(`   ${dim(ENV_FILE)}\n`);
        console.log(`   ${dim(`Entropy: ${entropy} bits per secret (${bytes} bytes)`)}\n`);
        for (const { label, envKey } of TOKEN_SECRETS) {
            console.log(`   ${green('•')} ${label} → ${envKey}`);
        }
        console.log(`\n${yellow('!')}  Restart the server to load the updated secrets.\n`);
        return;
    }

    // ── Print modes ───────────────────────────────────────────────────────
    console.log();

    if (format === 'raw') {
        // Pipe-friendly: one secret per line, no labels
        for (const { value } of secrets) {
            process.stdout.write(`${value}\n`);
        }
        return;
    }

    if (format === 'json') {
        const obj = Object.fromEntries(secrets.map(({ envKey, value }) => [envKey, value]));
        process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
        return;
    }

    // ── Human-readable header ─────────────────────────────────────────────
    console.log(bold('── EverCut JWT Secrets ───────────────────────────────────────────'));
    console.log(dim(`   Generated: ${new Date().toISOString()}`));
    console.log(dim(`   Entropy:   ${entropy} bits per secret (${bytes} bytes, base64url)`));
    console.log(dim('   Source:    crypto.randomBytes() — OS CSPRNG'));
    console.log();

    for (const { label, envKey, description } of TOKEN_SECRETS) {
        const secret = secrets.find((s) => s.envKey === envKey).value;
        console.log(bold(label));
        console.log(dim(`  # ${description}`));
        if (format === 'export') {
            console.log(green(`  export ${envKey}=${secret}`));
        } else {
            // dotenv (default)
            console.log(green(`  ${envKey}=${secret}`));
        }
        console.log();
    }

    console.log(bold('── Security Reminders ────────────────────────────────────────────'));
    console.log(`  ${yellow('•')} Each secret above is cryptographically independent.`);
    console.log(`  ${yellow('•')} Never reuse the same secret for different token types.`);
    console.log(`  ${yellow('•')} Never reuse secrets across environments (dev/prod).`);
    console.log(`  ${yellow('•')} Never commit .env to version control.`);
    console.log(`  ${yellow('•')} Rotate secrets if any are exposed or the environment is compromised.`);
    console.log(`  ${yellow('•')} After rotation, all existing tokens are immediately invalidated.`);
    console.log();
    console.log(dim(`  Tip: paste the block above into your .env file, or rerun with`));
    console.log(dim(`  ${blue('--write')} to have this script patch .env directly.`));
    console.log();
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv);

if (args.help) {
    printHelp();
} else if (args.check) {
    runCheck();
} else {
    generate(args);
}
