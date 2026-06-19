# ADR-006: Transition to Boot-Time Dependency Injection

## Status

Approved

## Context

In the previous implementation, statically defined Express middlewares (such as `requireVenuePermission`) could not access service instances at definition time. The system used a request-time binding middleware to attach service singletons to `req.app` dynamically:
```javascript
router.use((req, res, next) => {
  req.app.set('authService', authService);
  next();
});
```
Middlewares then resolved the service from `req.app` during request execution:
```javascript
const authService = req.app.get('authService');
```
This mutated the application settings namespace dynamically, created mutable request state, and obscured the dependency graph.

## Decision

1.  Eliminate all `req.app.set(...)` and `req.app.get(...)` service resolution patterns from the request pipeline.
2.  Refactor `requireVenuePermission` into a factory function `createRequireVenuePermission({ authorizationService })` that returns the middleware closure at router composition time.
3.  Inject dependencies statically during server startup (Composition Root).
4.  Configure `requireVenuePermission` with an explicit `venueResolver(req)` function passed at route registration time, allowing the route to define exactly how it extracts the venue context.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Request-time dynamic lookup (Service Locator) | Simpler routing file, but results in hidden dependencies, test isolation challenges, and dynamic app-level state mutation |
| Boot-time dependency injection | Clearer dependency graph and cleaner unit tests, but slightly increases boilerplate inside the bootstrap file |

## Consequences

*   **Benefits**:
    *   Eliminates per-request global state mutations.
    *   Makes route dependencies explicit and visible.
    *   Allows unit and integration test suites to easily inject mock authorization services at composition time.
*   **Trade-offs**: None.
