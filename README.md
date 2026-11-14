# Other Half

Other Half is a roommate and shared-housing discovery product for Indian metro cities. This repository is being built as a production-oriented TypeScript monorepo; the screens and sample content in the starter archive are product references and are being connected to real services feature by feature.

## Architecture

- `apps/web` — React, TypeScript, and Vite client.
- `apps/api` — Express REST API; owns validation, authorization, and business rules.
- `packages/contracts` — shared runtime schemas and API types.
- `prisma` — PostgreSQL data model and migrations.
- `infra` — local and deployment infrastructure configuration.
- `docs` — architecture decisions and feature roadmap.
- `reference` — local-only starter archive and generated reference material; excluded from Git.

The browser must not be treated as the source of truth for users, listings, matches, messages, or bookings. The API and PostgreSQL will own that data. Uploaded media will move to object storage; the browser cache is only for performance.

## Local development

Requirements: Node.js 22.12 or newer, npm 10 or newer, and Docker Desktop.

1. Copy `.env.example` to `.env`.
2. Install the locked packages with `npm ci`.
3. Start PostgreSQL, Redis, and local private media storage with `npm run infra:up`.
4. Generate the Prisma client and apply migrations with `npm run db:generate` and `npm run db:migrate`.
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and add a browser-restricted Google Maps key when map features are needed.
6. Run `npm run dev` and open `http://localhost:3000`.

The local object store console is available at `http://localhost:9001`. Local-only MinIO credentials and the private bucket are configured by the root `.env` values. Production deployments should supply their own private S3-compatible bucket credentials through the server environment; do not use the local defaults.

Production artifacts are built with `npm run build`; start the API with `npm run start --workspace=@other-half/api` after setting its environment variables. Production requires a reachable `REDIS_URL`; the API fails to start without shared rate-limit storage and returns not-ready if Redis becomes unavailable. Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front of the API (leave it at `0` when none are used) so IP-based security limits use the actual client address. The API build includes compiled shared contracts and the generated Prisma client.

### Container deployment

The production container setup builds a non-root API image and a non-root Nginx web image. Nginx serves the SPA and proxies `/api/` to the API on the private Compose network; only the web service publishes a port. PostgreSQL, Redis, and private S3-compatible object storage are expected to be managed services, not Compose containers.

1. Copy `.env.production.example` to `.env.production` and set the production web origin, managed database and Redis URLs, private object-storage credentials, and restricted browser Maps key as needed. Keep the real file out of Git.
2. Build release images with `docker compose --env-file .env.production -f infra/compose.production.yaml build`.
3. Apply committed database migrations with `docker compose --env-file .env.production -f infra/compose.production.yaml run --rm migration`.
4. Start the application with `docker compose --env-file .env.production -f infra/compose.production.yaml up -d` and put a TLS reverse proxy or load balancer in front of the published web port.

The API container has a readiness health check and no published host port. The migration service is an explicit one-shot release step, so deployment automation can apply schema changes before replacing application containers. Set `IMAGE_TAG` to an immutable release tag when publishing images instead of using the local default.

The API listens on `http://localhost:4000`; `GET /api/v1/health` reports application, database, and shared rate-limit storage readiness and `GET /api/v1/health/live` is the process liveness endpoint.

## Delivery approach

See [the product and delivery roadmap](docs/PROJECT_PLAN.md) and [the architecture decisions](docs/ARCHITECTURE.md). Each milestone is a working vertical slice with persisted data, authorization, validation, and a usable interface before moving on.
