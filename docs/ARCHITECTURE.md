# Architecture

## System shape

```text
Browser (React/Vite)
        │ HTTPS, versioned JSON API
        ▼
Express API ───── PostgreSQL (Prisma)
        │
        ├──── Object storage for user media
        ├──── Email provider for verification and recovery
        └──── Google Maps browser SDK (restricted public key)
```

We are starting with a modular monolith. Housing discovery, profiles, matching, messaging, and tours are separate API/domain modules inside one deployable API. This keeps local development and transactions straightforward while preserving module boundaries. A service split is only justified by measured scale or independent operational needs.

## Boundaries and data ownership

- The web app renders screens and calls the versioned API. It never owns authorization decisions.
- The API validates every request and enforces identity, ownership, and visibility rules.
- PostgreSQL is the source of truth. Prisma migrations are committed with schema changes.
- Shared Zod schemas describe API payloads at runtime and at compile time.
- User-uploaded photos and videos belong in private object storage with signed upload/download URLs. They do not belong in `localStorage` or IndexedDB as the durable copy.
- Secrets stay in server environment configuration. A browser Maps key is public by design and must be restricted by origin and enabled APIs; server credentials must never use a `VITE_` prefix.

## Initial domain model

`User` is the authentication identity. `Profile` is editable product information with a one-to-one user relation. `Listing` belongs to one user and stores a neighborhood-level location, rent, availability, amenities, and household details; exact street addresses are not collected. `SavedListing` is a user/listing join record so saved homes persist across sessions and devices. Listing media will be added through private object storage after a provider is configured. Later migrations add likes/matches, conversations/messages, and tour requests. Sensitive identity and moderation data will remain separate from public profile and listing fields.

## Reliability and security baseline

- Readiness checks verify database connectivity; liveness checks only verify the process.
- Helmet sets standard HTTP security headers; CORS is restricted to the configured web origin; request bodies have a size limit.
- Production sessions will use secure, HTTP-only, same-site cookies and server-side revocation. Passwords will use a deliberately slow password hash; raw credentials never enter logs.
- Every endpoint that changes data will validate input, authenticate the caller, authorize the target resource, and use database constraints/transactions where needed.
- Migrations, secrets, backups, structured logs, rate limits, monitoring, and deployment automation are required before public launch.

## Repository layout

```text
apps/
  api/src/{routes,modules,lib}
  web/src/{components,data,hooks,services}
packages/contracts/src
prisma/{schema.prisma,migrations}
infra/
docs/
reference/
```
