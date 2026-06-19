# ADR-005: Decoupling of Authentication and Authorization Domains

## Status

Approved

## Context

In the initial security audit, authentication (identity resolution) and authorization (capability validation) were co-located under the monolithic `auth` module. Routines like OTP validation, password hashing, session creation, and role-to-permission database checks were managed by the same repositories and services.

## Decision

Separate the authentication (AuthN) and authorization (AuthZ) domains conceptually and logically:
1.  **Authentication**: Handled via token signature verification, database session validation, and completing user profile onboarding. These act as runtime gating mechanisms.
2.  **Authorization**: Evaluated through specific database capability queries (`VenueUserRole` and `RolePermission` tables) resolving user permissions contextually.

The runtime `hasPermission` methods are kept clean, while deprecated middleware guards like `authorize` and `requirePermissions` are deleted.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Maintain monolithic Auth service | Simpler layout initially, but couples payment/booking domain authorization directly to session and credential verification details |
| Decouple AuthN and AuthZ modules | Clear separation of concerns; requires passing dependencies down explicitly rather than relying on global auth modules |

## Consequences

*   **Benefits**:
    *   Simplified dependency chains: down-stream domain modules (like payments) query authorization capabilities without coupling to authentication session management.
    *   Enhanced maintainability: identity parsing rules can evolve (e.g. migrating to OAuth/OpenID Connect) without impacting business role checking logic.
*   **Trade-offs**: None. Since this is a greenfield project with no legacy consumers, there are no backward-compatibility issues.
