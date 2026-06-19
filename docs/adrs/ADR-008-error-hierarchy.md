# ADR-008: Standardized Domain Error Hierarchy

## Status

Approved

## Context

When authorization checks failed, the codebase threw generic `Error` instances in several locations (e.g. when venue details were missing or services were misconfigured). This resulted in unhandled exceptions returning generic HTTP 500 Internal Server Errors to clients, instead of descriptive HTTP 403 or 400 responses.

## Decision

Create distinct subclasses of `AppError` inside `src/utils/api-error.js` to represent authorization-specific failure states:
1.  **`ConfigurationError` (HTTP 500)**: Thrown when dependencies or required services are missing during boot-time construction or runtime execution.
2.  **`MissingVenueContextError` (HTTP 403)**: Thrown when an operation requiring a venue context is executed without resolving a valid venue identifier.
3.  **`PermissionDeniedError` (HTTP 403)**: Thrown when a user lacks the specific permission key needed to execute a request.

Ensure all custom errors inherit from `AppError` so they are automatically captured by the global `errorHandler` middleware and serialized consistently.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Use generic base `Error` class and check messages | Highly brittle; requires string matching on error messages in controllers or middleware |
| Implement custom error subclasses inheriting from standard `AppError` | Provides clean semantic types, allows individual status code mapping, and integrates naturally with the existing error handler |

## Consequences

*   **Benefits**:
    *   Ensures consistent JSON error formats and appropriate HTTP status codes for clients.
    *   Improves error tracking and separates developer configuration errors from user validation errors.
*   **Trade-offs**: None.
