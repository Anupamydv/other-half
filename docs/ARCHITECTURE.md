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

`User` is the authentication identity. `Profile` is editable product information with a one-to-one user relation and an explicit discovery opt-in. `DiscoveryAction` records one pass/like/super-like per member pair. `Match` is a normalized pair created only when both members like each other; it opens one private match conversation. `UserBlock` hides members from discovery, the community feed, and new messages while preserving history. `UserReport` stores private safety reports; only moderators can see the review queue and change report status. `CommunityPost` stores bounded text updates by city and neighborhood; likes and saves are unique member/post joins, and comments are persisted separately. Community post reads require a session, and blocked authors are filtered from results. `Listing` belongs to one user and stores neighborhood-level location, rent, availability, amenities, and household details; exact street addresses are not collected. Optional listing pins are rounded to two decimal places by the API before persistence and never expose the exact clicked coordinate. `SavedListing` is a user/listing join record so saved homes persist across sessions and devices. `ListingMedia` tracks private object keys and only becomes visible after an upload is verified. The API issues temporary signed upload/read URLs, limits listings to five JPEG/PNG/WebP images up to 10 MB each, and checks the stored size, content type, and file signature. `TourRequest` links a guest to a listing and records a requested visit window and its owner-controlled status. `Notification` stores user-scoped in-app updates for visit request lifecycle events and is created in the same transaction as the corresponding status change. Conversations can originate from a listing visit or mutual roommate match. `ConversationMessage` stores bounded text messages; participants alone can read and send. Per-participant read timestamps power inbox unread state. Sensitive identity and moderation data remain separate from public profile and listing fields.

## Reliability and security baseline

- Readiness checks verify database connectivity; liveness checks only verify the process.
- Helmet sets standard HTTP security headers; CORS is restricted to the configured web origin; request bodies have a size limit.
- Production sessions will use secure, HTTP-only, same-site cookies and server-side revocation. Passwords will use a deliberately slow password hash; raw credentials never enter logs.
- Every endpoint that changes data will validate input, authenticate the caller, authorize the target resource, and use database constraints/transactions where needed.
- Members can download an authenticated JSON export of their profile and account activity. Password hashes, session tokens, and unrelated members’ private profiles are excluded; exported listing-photo links are temporary.
- Migrations, secrets, backups, structured logs, rate limits, monitoring, and deployment automation are required before public launch.
- GitHub Actions runs locked dependency installation, workspace typechecking, production builds, and Prisma schema validation on pull requests and pushes to `main`.

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
