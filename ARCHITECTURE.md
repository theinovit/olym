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
- **Nome da instância**: o setup ganha um campo extra "Instance/Organization name" (estilo site title do WordPress) — persistido numa tabela singleton `instance_settings` (id fixo, `name`, `createdAt`), criada junto com a conta admin no `POST /api/auth/setup`. Settings → General já tem esse campo na UI (hoje mockado, só `toast.success` local) — passa a ler/gravar de verdade via API.
- **Domínio + portas no installer**: `scripts/install.sh` deve deixar claro que `OLYM_HOST` precisa ser um domínio real (ex. `painel.suaempresa.com`) com um registro DNS A apontando pro IP da VPS — não a instalação em si que resolve isso. Portas **80 e 443** precisam estar acessíveis publicamente na VPS (desafio HTTP-01 do Let's Encrypt via Traefik + tráfego HTTPS); o installer deve: (a) checar se as portas já estão ocupadas por outro processo antes de subir a stack, falhando com mensagem clara em vez de conflito silencioso; (b) detectar `ufw` ativo e, se estiver bloqueando, oferecer abrir 80/443 automaticamente (com confirmação, nunca silencioso); (c) deixar explícito no prompt/output que o usuário precisa configurar o DNS antes de rodar.

## Fases

- **F1 (agora):** UI completa com dados mock + schema Drizzle + API contracts. Instalador compose.
- **F2:** deploy engine real (git clone → build → run → Traefik), logs SSE, serviços one-click.
- **F3:** mail server, monitoring, teams/RBAC, multi-server, CLI, MCP server para AI agents.

## Fonte de deploy: Git ou imagem Docker pronta (Sprint 19)

Hoje toda Application exige `repoUrl` (clone → build via Dockerfile do repo). Adicionar um segundo caminho: apontar direto para uma imagem já publicada (Docker Hub, GHCR, qualquer registry), sem clonar nem buildar nada — só `docker pull` + rodar.

- **Schema**: `applications.repoUrl` vira opcional (nullable); novo campo `dockerImage` (text, nullable). Regra: exatamente um dos dois deve estar preenchido (nunca os dois, nunca nenhum) — validar na camada de aplicação (zod) na criação, não precisa de CHECK constraint no banco.
- **Deploy engine**: quando `dockerImage` está preenchido, o worker pula inteiramente `cloneAndBuildApplication` — nova função equivalente (ex. `pullImageForApplication`) faz só o pull da imagem e retorna o mesmo formato (`{ imageTag, ... }`) que `startApplicationContainer`/o readiness gate/labels do Traefik já consomem hoje. Nenhuma mudança no que vem depois do build (readiness, swap zero-downtime, Traefik) — só a etapa de "como chegar numa imagem" muda.
- **API**: `POST /api/applications` aceita `{ repoUrl, branch }` OU `{ dockerImage }` — a validação de Git (`src/server/git.ts`) só roda quando `repoUrl` está presente.
- **FE**: o fluxo de criação de Application (hoje o node nasce com `repoUrl: ""` fixo no Add Palette, depois configurado no painel do nó) precisa de uma escolha explícita **"Deploy from Git repository"** vs **"Deploy from Docker image"** — investigar o ponto certo de integração (Add Palette ao criar, ou tab Overview/Settings do painel do nó, que hoje não expõe edição de repo/branch ainda). Campos condicionais: Git mostra repo+branch; Imagem mostra `imagem:tag`.

## Provisionamento real de serviços (Sprint 21)

Achado ao investigar: hoje "adicionar um serviço" (Postgres, Redis, etc.) só insere uma linha em `service_instances` com `status: "stopped"` — `createService` (`src/server/services/services.ts`) nunca sobe um container de verdade. `bindings.ts` só guarda o NOME da env var que seria injetada (`injectedVarKey`, ex. `DATABASE_URL`), nunca um valor real. Ou seja: nenhum serviço one-click está de fato rodando nem tem credenciais reais — é só scaffolding de catálogo/canvas.

Isso precisa virar real:

1. **Provisionar de verdade**: ao criar (ou "deployar") um service instance, rodar via dockerode a imagem correta do template (`serviceTemplates` já tem nome/versão) na mesma rede Docker (`OLYM_DOCKER_NETWORK`) dos apps, com um nome de container previsível (ex. `olym-svc-<id curto>`). Gerar credenciais aleatórias no momento da criação: usuário/senha/nome do banco para Postgres/MySQL/Mongo, senha para Redis, access/secret key para MinIO — o gerador varia por categoria do template (`serviceCategoryEnum`).
2. **Guardar credenciais com segurança**: nova tabela (ex. `service_credentials`: `serviceInstanceId`, `key`, `value`) com os valores **criptografados em repouso** (libsodium, já citado no backlog do BE) — nunca texto plano no banco. Ao ler para exibir/injetar, descriptografar em memória.
3. **Atualizar status real**: `service_instances.status` passa a refletir o container de verdade (running/stopped/failed), não mais um valor estático.
4. **Bindings passam a injetar valor real**: quando uma app se liga a um serviço, a env var (`injectedVarKey`) recebe a connection string real montada a partir do container name + porta + credenciais — hoje só a chave é registrada, o valor nunca existiu.
5. **Expor a connection string na UI**: no painel do nó do serviço (Overview ou nova aba "Connect"), mostrar a connection string completa mascarada por padrão com botão de copiar/revelar (mesmo padrão de mascaramento já usado em Variables). Isso é o gap que motivou essa investigação: hoje não tem nenhuma forma de ver a credencial de um serviço.

Sequenciar: item 1-3 são BE puro; item 4 depende de 1-3; item 5 é FE consumindo um novo endpoint (ex. `GET /api/service-instances/[id]/connection`).

## Bug crítico: Projects nunca conectado à API real (achado testando a UI)

Testando o produto de ponta a ponta (criar serviço via canvas): `addResource` foi corrigido pra chamar a API real, mas continuou falhando — causa raiz é mais funda.

- `src/app/(dashboard)/projects/page.tsx` → `ProjectsGrid` usa `mockProjects` importado direto de `@/lib/mock-data`, nunca chama `GET /api/projects` (que já existe e funciona).
- `src/app/(dashboard)/projects/[slug]/page.tsx` também usa `mockProjects.find(...)`, nunca busca do banco real. `generateStaticParams` gera as rotas estáticas a partir do mock.
- Resultado: o `project` passado pro canvas tem um `id` FAKE (não é UUID), então qualquer `POST` que referencia `projectId` (aplicações, serviços) falha com erro de tipo no Postgres (`invalid input syntax for type uuid`).
- `POST /api/projects` (criar projeto) tem um bug à parte: o route handler (`src/app/api/projects/route.ts`) está **hardcoded pra sempre retornar 501 Not Implemented**, mesmo a função de serviço `createProject()` (`src/server/services/projects.ts`) já tendo a query real do Drizzle implementada e funcional — o route handler simplesmente nunca chama a função.

Correções:
1. **BE**: `POST /api/projects` — trocar o `return errorResponse(501, ...)` hardcoded por uma chamada real a `createProject(result.data)` + `dataResponse(project, { status: 201 })`.
2. **FE**: `/projects` (lista) busca de `GET /api/projects` em vez de `mockProjects`. `/projects/[slug]` busca a lista real e filtra por slug (não existe endpoint por slug ainda, reusar a lista) — remover/ajustar `generateStaticParams` já que projetos passam a ser dinâmicos, não estáticos. Fluxo de "New Project" passa a chamar o `POST /api/projects` (agora real).

## Regras para o squad

1. Frontend não toca em `src/server` e `src/db`; Backend não toca em `src/app/(dashboard)` e `src/components` (exceto `src/app/api`). Contrato entre os dois: tipos em `src/lib/types.ts`.
2. Todo trabalho termina com `pnpm lint && pnpm build` passando.
3. Commits pequenos e frequentes na branch `main` (por enquanto). Mensagens em inglês, convencionais (`feat:`, `fix:`).
4. Dados mock realistas em `src/lib/mock-data.ts` (Frontend cria, Backend substitui por queries reais na F2).
