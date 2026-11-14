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

### 1. Identity and profile - in progress

- [x] Registration and login with server-side scrypt password hashes.
- [x] Revocable seven-day sessions stored as SHA-256 token hashes and delivered in HTTP-only cookies.
- [x] Same-site cookie policy, origin checks on write requests, and an initial per-process auth rate limit.
- [x] Persist and validate editable profile details and lifestyle preferences.
- [x] Edit age and neighborhood; change password and revoke other active sessions.
- [ ] Email verification, password recovery, account deletion, and production shared rate-limit storage.
- Acceptance: a user can create an account, return in a new browser session, edit their profile, and access no other user's private data.

The current identity slice implements registration, login/logout, session lookup, and profile/preference updates. Email verification and password recovery are deferred until an email provider and sender domain are configured. The in-memory rate limiter is suitable only for a single API process; deploy behind shared rate-limit storage before scaling to multiple replicas.

### 2. Housing listings and media - in progress

- [x] Create, edit, and archive a room or flat listing with owner-only mutations.
- [x] Browse active listings by city, neighborhood, maximum rent, room type, move-in date, and required amenities with cursor pagination.
- [x] Save and unsave listings to a persistent personal list.
- [x] Store rent, deposit, availability, minimum stay, amenities, and household expectations without collecting exact street addresses.
- [x] Upload listing images to private S3-compatible object storage using validated signed uploads, with size/type limits and verification status.
- [ ] Add video uploads and asynchronous media processing/transcoding.
- [x] Filter listings by the desired move-in date and all selected amenities.
- [x] Add map-friendly listing coordinates rounded to neighborhood-level precision, with an optional owner-selected map pin.
- Acceptance: listing changes persist across devices, unauthorized edits are rejected, and incomplete uploads never appear as published listings.

Listing photos use private S3-compatible object storage. The API creates short-lived signed upload URLs, checks stored size, declared content type, and file signature before marking a photo ready, and returns temporary read URLs. Local development uses MinIO via `docker compose -f infra/compose.yaml up -d minio minio-init`; configure the `MEDIA_S3_*` values in `.env` (copy the local examples). Uploads are limited to five JPEG/PNG/WebP images per active listing, 10 MB each. Video and image processing are still deferred. Public listing responses intentionally expose neighborhood-level location only.

Listing owners can optionally select an approximate map pin. The API rounds coordinates to two decimal places (roughly one kilometer) before persisting or returning them; exact pin coordinates never enter the database. This uses the restricted browser Maps key already needed by the map screen. Listings can still be created without a pin or Maps credentials.

### 3. Compatibility and matching

- [x] Persist lifestyle answers and show a deterministic, documented compatibility score on opted-in member profiles.
- [x] Record pass/like/super-like actions idempotently; create a match and private conversation only under the mutual-interest rule.
- [x] Require explicit discovery opt-in, including a self-declared age of 18 or older; only return profile fields needed for discovery.
- [x] Add member reporting, moderator review, and block/unblock controls before broad discovery.
- Acceptance: match state is consistent across devices, cannot be forged by changing browser storage, and opt-out profiles never appear in discovery.

Discovery is account-backed and city-scoped. Profiles are hidden until the member explicitly enables discovery; each member can make one durable action per profile. Likes and super-likes count as positive interest. When both members have expressed positive interest, the API creates a normalized match record and a private match conversation in one transaction. The compatibility percentage is informational and never determines who can match.

### 4. Messaging and tour requests - in progress

- [x] Persist guest visit requests and let listing owners confirm or decline a requested window.
- [x] Let guests track and cancel pending visit requests; reject conflicting accepted time windows.
- [x] Create a private conversation only after a visit is confirmed, with membership limited to the guest and listing owner.
- [x] Persist validated messages, paginate history, track unread/read state, and refresh active threads.
- [x] Let either participant block the other; preserve message history and prevent new sends.
- [x] Persist in-app notifications for request, confirmation, decline, and cancellation events; no automatic fabricated replies.
- Acceptance: only conversation members can read/send; every tour status change is attributable and visible to both parties.

### 5. Maps and commute discovery

- [x] Browse owner-opted-in approximate listing pins on a map alongside filtered housing search.
- Browser geolocation with clear consent and manual fallback; do not persist precise user location by default.
- Maps and routing through restricted, monitored provider credentials; handle quotas, provider errors, and unsupported travel modes.
- Acceptance: navigation only uses user-approved origin and clearly distinguishes estimate from confirmed address.

### 6. Launch readiness

- [x] Provide an authenticated JSON export of the member’s app data without authentication secrets.
- Automated unit/integration/accessibility/e2e coverage; dependency/security review; performance and abuse testing.
- Moderation operations, privacy policy/terms, account export/deletion, support workflow, backups and restore drills.
- Production observability, alerting, rollout/rollback, and environment-specific configuration.

## Current scope

The supplied ZIP is treated as a visual/product idea. Its seeded profiles, localStorage data store, simulated chat replies, and generated build output are not production behavior and will be replaced as the corresponding backend milestones are implemented. Existing React screens and licensed/project-provided assets remain available as a presentation reference during the transition.
