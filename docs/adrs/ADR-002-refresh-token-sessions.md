# ADR-002: Add Refresh Token Rotation and Server-Side Sessions From Day One

## Status

Accepted

## Context

Earlier launch documentation used a 24-hour access token with client-side logout and deferred revocation. The updated requirement supersedes that approach and requires refresh tokens, session management, refresh-token rotation, current-device logout, all-device logout, and session revocation before launch.

## Decision

Use short-lived JWT access tokens plus opaque refresh tokens stored in HTTP-only cookies. Store refresh-token hashes and auth-session records in PostgreSQL. Rotate refresh tokens on every refresh request. Revoke the active session on logout and all user sessions on logout-all. Treat reuse of a revoked refresh token as a compromised session and revoke the full session.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| 24-hour access token only | Simpler, but no revocation or session visibility |
| JWT refresh tokens | Easier to verify statelessly, but harder to revoke and rotate safely |
| Opaque refresh tokens with DB sessions | More database work, but supports rotation, revocation, audit, and device sessions |

## Consequences

The API specification and business-logic docs must be updated to replace the old token lifecycle. Frontend route guards must hydrate auth state from backend-backed sessions, not demo cookies. Session tables become part of the launch schema.
