# ADR-003: Use Environment-Selected OTP Providers

## Status

Accepted

## Context

Customer login uses WhatsApp OTP. Local development and automated tests need deterministic OTP behavior without calling Meta APIs. Production must integrate with WhatsApp Cloud API without changing auth business logic.

## Decision

Expose an OTP provider interface with `sendOtp({ phone, code, purpose })`. Select the concrete provider using `OTP_MODE`.

| Mode | Provider |
|---|---|
| `sandbox` | Always sends/accepts `123456` for local development |
| `test` | Uses `OTP_TEST_CODE` for deterministic automated tests |
| `production` | Sends via WhatsApp Cloud API |

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Hard-code `123456` in frontend | Not secure and prevents backend validation |
| Branch inside auth service | Couples business logic to delivery providers |
| Provider abstraction | Slightly more structure, but isolates production integration cleanly |

## Consequences

Production WhatsApp work can be added or replaced without changing OTP validation, user upsert, session issuance, or frontend flows.
