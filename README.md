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
2. Install packages with `npm install`.
3. Start PostgreSQL with `npm run db:up`.
4. Generate the Prisma client and apply migrations with `npm run db:generate` and `npm run db:migrate`.
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and add a browser-restricted Google Maps key when map features are needed.
6. Run `npm run dev` and open `http://localhost:3000`.

The API listens on `http://localhost:4000`; `GET /api/v1/health` reports application and database readiness and `GET /api/v1/health/live` is the process liveness endpoint.

## Delivery approach

See [the product and delivery roadmap](docs/PROJECT_PLAN.md) and [the architecture decisions](docs/ARCHITECTURE.md). Each milestone is a working vertical slice with persisted data, authorization, validation, and a usable interface before moving on.
