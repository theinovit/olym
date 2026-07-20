# Olym

**Self-hosted PaaS with an AI-native core.** Deploy, diagnose, and roll back your apps on your own server through a spatial, canvas-first dashboard — think Vercel/Coolify, but the agent reads your build logs, explains failures in plain language, and can suggest or apply fixes.

> Status: pre-release, under active development. Core deploy flow (Git → Docker → Traefik) is being wired up now (F2). Not yet ready for production use.

## Why

Coolify, Dokploy, and CapRover cover the self-hosted PaaS space well, but none of them treat AI as a first-class part of the deploy loop. Olym's bet is that diagnosing a failed build or a misconfigured domain shouldn't require reading raw logs — the platform should be able to explain what broke and offer to fix it.

## What it does today

- **Canvas-first dashboard** — projects are a live graph (`@xyflow/react`): apps and services as nodes, bindings (env var injection) as draggable connections, real-time status via kite-line edges.
- **One-click service catalog** — Postgres, Redis, MySQL, MongoDB, MinIO, Meilisearch, and more, provisioned from templates.
- **Live deployment lifecycle** — queued → building → deploying → running/failed, streamed over SSE, with rollback pointing at the previous deployment.
- **Domains & SSL** — Traefik-managed routing and certificates.
- **Light-first UI** — `next-themes`, full dark mode support, shadcn/ui components.

## Stack

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · Drizzle ORM + Postgres · BullMQ/Redis · Traefik · Docker

## Getting started (development)

```bash
pnpm install
cp .env.example .env       # fill in DATABASE_URL, REDIS_URL, etc.
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The app runs without `DATABASE_URL`/`REDIS_URL` set — it falls back to realistic in-memory mock data so the UI is explorable standalone.

## Self-hosted install

```bash
curl -fsSL get.olym.sh | bash
```

Spins up the full stack via Docker Compose: app + Postgres + Redis + Traefik + a docker-socket-proxy (the app and Traefik never touch the raw Docker socket directly).

## Project structure

```
src/
  app/            # routes (App Router)
    (dashboard)/  # authenticated shell: home, projects, deployments, servers, domains, monitoring, settings
    api/          # route handlers
  components/     # product UI (shadcn primitives live in components/ui, generated, not hand-edited)
  server/         # business logic, Docker/deploy engine, services
  db/             # Drizzle schema + migrations
  lib/            # shared types and utilities
```

See `ARCHITECTURE.md` for the full technical breakdown and `DESIGN.md` for the UI/UX language and its history.

## Roadmap

- **F1 (done):** full UI on mock data, Drizzle schema, API contracts, Compose installer.
- **F2 (in progress):** real deploy engine (Git clone → Docker build → Traefik), live build logs, GitHub auth (PAT → deploy keys → GitHub App).
- **F3:** mail server, monitoring, teams/RBAC, multi-server, CLI, MCP server for AI agents.

## Contributing

Olym is early and the API surface is still moving fast. Open an issue before sending a large PR so we can align on direction. Small, focused PRs (`feat:`/`fix:` conventional commits) are the easiest to review.

## License

MIT — see [LICENSE](LICENSE).
