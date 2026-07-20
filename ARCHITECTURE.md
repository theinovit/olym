# Olym — Arquitetura

PaaS self-hosted open-source (estilo Coolify/OpenShip): build, deploy, operação e escala de aplicações na sua própria infraestrutura, com instalação simples (um comando / um container).

## Decisões de stack (v1)

| Camada | Escolha | Por quê |
|---|---|---|
| Dashboard + API | **Next.js 16 (App Router, standalone output)** | Full-stack num só processo, roda em qualquer VPS via Node 22 ou container. Mesmo caminho do Dokploy. |
| UI | Tailwind CSS v4 + shadcn/ui | Requisito do projeto. Light mode default + dark mode (next-themes). |
| Banco | PostgreSQL + **Drizzle ORM** | Fonte de verdade de projetos/deploys/servers. Migrations versionadas desde o dia 1. |
| Fila/Jobs | BullMQ + Redis (worker separado) | Builds e deploys são long-running — nunca dentro do request do Next. |
| Orquestração | Docker Engine API via **dockerode** | Containers por app/serviço. Rootless quando possível. |
| Proxy | **Traefik** (labels dinâmicos) | SSL automático (Let's Encrypt), zero-downtime, nunca proxy próprio. |
| Logs em tempo real | SSE (Server-Sent Events) | Simples, funciona atrás de proxy, sem infra extra de WebSocket. |
| Instalação | `curl -fsSL get.olym.sh \| bash` → docker compose (app + postgres + redis + traefik) | Simplicidade de instalação é requisito nº 1 do produto. |

## Estrutura de pastas

```
src/
  app/            # rotas (App Router) — DONO: Frontend
    (dashboard)/  # shell autenticado: home, projects, deployments, servers, domains, monitoring, settings
    api/          # route handlers — DONO: Backend
  components/
    ui/           # shadcn (gerado, não editar na mão)
    ...           # componentes do produto — DONO: Frontend
  server/         # lógica de negócio, serviços, docker, deploy engine — DONO: Backend
  db/             # schema Drizzle + migrations — DONO: Backend
  lib/            # utils compartilhados
```

## Domínio (entidades núcleo)

- **Server** — VPS/host alvo (localhost na v1; multi-server depois). Conexão via socket local ou SSH.
- **Project** — agrupa apps + serviços + ambientes.
- **Environment** — production / staging / development por projeto (isolamento de secrets, domínios e serviços).
- **Application** — app deployável: source (git repo + branch), build (Dockerfile → Nixpacks depois), portas, domínios, env vars.
- **Service** — serviço one-click (PostgreSQL, Redis, MySQL, MongoDB, MinIO, Meilisearch… catálogo de templates compose).
- **Deployment** — execução de build+deploy: status, logs, commit, rollback aponta para deployment anterior.
- **Domain** — domínio/subdomínio → app, SSL automático via Traefik.

## Autenticação (Sprint 15)

Olym v1 é **single-tenant**: uma conta admin por instalação, sem multi-user/RBAC ainda (isso é F3). Modelo:

- **`users`** (Drizzle): `id`, `email` (unique), `passwordHash`, `createdAt`. Hash com `bcryptjs` (puro JS — evita build nativo na imagem Alpine).
- **Primeiro acesso ("setup")**: `GET /api/auth/status` retorna `{ hasAccount: boolean }`. Se `false`, a UI mostra uma tela "Create your admin account" (email + senha) em vez de login. `POST /api/auth/setup` só cria a conta se ainda existir zero users no banco — depois disso, o endpoint fica permanentemente bloqueado (evita criação de uma segunda conta por essa via).
- **Login**: `POST /api/auth/login` (email + senha) → valida hash, seta cookie de sessão `HttpOnly; Secure; SameSite=Lax` assinado via HMAC com `OLYM_SECRET` (já existe em `.env.example`, hoje sem uso).
- **Logout**: `POST /api/auth/logout` limpa o cookie.
- **Middleware** (`src/middleware.ts`): protege todas as rotas de `(dashboard)` e `/api/*` exceto `/api/auth/*` — sem sessão válida, redireciona para `/login` (ou `/setup` quando `hasAccount:false`).
- **Conta do usuário**: o avatar flutuante do chrome v4 (canto inferior esquerdo) passa a refletir a sessão real e ganha ação de logout.

## Fases

- **F1 (agora):** UI completa com dados mock + schema Drizzle + API contracts. Instalador compose.
- **F2:** deploy engine real (git clone → build → run → Traefik), logs SSE, serviços one-click.
- **F3:** mail server, monitoring, teams/RBAC, multi-server, CLI, MCP server para AI agents.

## Regras para o squad

1. Frontend não toca em `src/server` e `src/db`; Backend não toca em `src/app/(dashboard)` e `src/components` (exceto `src/app/api`). Contrato entre os dois: tipos em `src/lib/types.ts`.
2. Todo trabalho termina com `pnpm lint && pnpm build` passando.
3. Commits pequenos e frequentes na branch `main` (por enquanto). Mensagens em inglês, convencionais (`feat:`, `fix:`).
4. Dados mock realistas em `src/lib/mock-data.ts` (Frontend cria, Backend substitui por queries reais na F2).
