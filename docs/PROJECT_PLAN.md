# Product and delivery roadmap

## Product goal

Help people moving within Bengaluru, Mumbai, Delhi NCR, and Hyderabad find compatible flatmates and trustworthy shared homes. The product combines lifestyle fit, transparent housing costs, media-rich listings, and a safe path from discovery to a real visit.

## Build principles

- Deliver one end-to-end usable capability at a time.
- Store canonical product data on the server; no simulated matches, chat replies, or successful bookings.
- Build privacy, authorization, validation, accessible UI, and failure states into each feature.
- Keep sample fixtures clearly separated from user data and development-only.
- Use real providers behind explicit adapters; external integrations must show an honest unavailable state when credentials are absent.

## Milestones

### 0. Project foundation — in progress

- [x] Reorganize the idea starter into a web/API/shared-contracts monorepo.
- [x] Add Express API with liveness/readiness endpoints, secure headers, bounded JSON bodies, and configured CORS.
- [x] Define PostgreSQL/Prisma user and profile foundation.
- [x] Add a local Postgres container and environment template.
- [x] Connect the web shell to API readiness and show service state.
- [ ] Install dependencies, create the first migration, and run the full project locally.
- [ ] Add CI checks, error reporting, and deployment configuration.

### 1. Identity and profile — next

- Registration, email verification, login, logout, password recovery, and session revocation.
- Secure HTTP-only cookie sessions, CSRF protection, rate limits, and credential abuse controls.
- Persist profile details and lifestyle preferences; support edit, validation, and account deletion.
- Acceptance: a user can create an account, return in a new browser session, edit their profile, and access no other user's private data.

### 2. Housing listings and media

- Create/edit/archive a room or flat listing with address privacy, rent, deposit, availability, amenities, and household expectations.
- Upload images/video to object storage using validated signed uploads, with size/type limits and processing status.
- Search/filter by city, neighborhood, budget, availability, and required attributes; provide map-friendly coordinates with location privacy controls.
- Acceptance: listing changes persist across devices, unauthorized edits are rejected, and incomplete uploads never appear as published listings.

### 3. Compatibility and matching

- Persist lifestyle answers and implement documented, deterministic compatibility scoring.
- Record pass/like/super-like actions idempotently; create a match only under the agreed mutual-interest rule.
- Add moderation/report/block controls before broad discovery.
- Acceptance: match state is consistent across devices and cannot be forged by changing browser storage.

### 4. Messaging and tour requests

- Real conversation membership and persisted messages, unread state, pagination, and delivery/read semantics.
- Tour request/accept/decline lifecycle and notifications; no automatic fabricated replies.
- Acceptance: only conversation members can read/send; every tour status change is attributable and visible to both parties.

### 5. Maps and commute discovery

- Browser geolocation with clear consent and manual fallback; do not persist precise user location by default.
- Maps and routing through restricted, monitored provider credentials; handle quotas, provider errors, and unsupported travel modes.
- Acceptance: navigation only uses user-approved origin and clearly distinguishes estimate from confirmed address.

### 6. Launch readiness

- Automated unit/integration/accessibility/e2e coverage; dependency/security review; performance and abuse testing.
- Moderation operations, privacy policy/terms, account export/deletion, support workflow, backups and restore drills.
- Production observability, alerting, rollout/rollback, and environment-specific configuration.

## Current scope

The supplied ZIP is treated as a visual/product idea. Its seeded profiles, localStorage data store, simulated chat replies, and generated build output are not production behavior and will be replaced as the corresponding backend milestones are implemented. Existing React screens and licensed/project-provided assets remain available as a presentation reference during the transition.
