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
1. **BE**: `POST /api/projects` — trocar o `return errorResponse(501, ...)` hardcoded por uma chamada real a `createProject(result.data)` + `dataResponse(project, { status: 201 })`. ✅ (commit `15f6946`)
2. **FE**: `/projects` (lista) busca de `GET /api/projects` em vez de `mockProjects`. `/projects/[slug]` busca a lista real e filtra por slug (não existe endpoint por slug ainda, reusar a lista) — remover/ajustar `generateStaticParams` já que projetos passam a ser dinâmicos, não estáticos. Fluxo de "New Project" passa a chamar o `POST /api/projects` (agora real). ✅ (commits `01e5e24`, `014fc35`, `f1c0159`)

Validado ao vivo no browser: criar um serviço Redis no canvas de `acme-storefront` agora funciona ponta a ponta (POST real → container Docker real → status `Running`) e a connection string aparece numa aba "Connect" no painel do nó. ✅ (commit `5d0e857`, consumindo o endpoint do Sprint 21 item 5)

## Bug crítico #2: canvas do projeto (`ProjectDetail`) inteiro ainda é mock

Achado testando o mesmo fluxo: dar refresh na página `/projects/acme-storefront` depois de criar o serviço Redis faz o node desaparecer. Causa raiz: `src/components/project-detail.tsx` nunca foi corrigido — só a página wrapper (`page.tsx`) e a lista (`projects-grid.tsx`) foram. `ProjectDetail` ainda importa `mockApplications`, `mockServiceInstances`, `mockDomains`, `mockDeployments`, `mockBindings`, `mockServiceTemplates` de `@/lib/mock-data` e filtra por `project.id` — como `project.id` agora é um UUID real, os filtros de mock (que usam ids fake tipo `proj_01`) sempre retornam array vazio. Ou seja: **toda criação de recurso funciona e persiste no banco, mas nada é lido de volta** — o canvas nunca reflete o estado real após um reload.

Gap adicional descoberto: `GET /api/service-instances` **não existe** (o route handler só tem `POST`). `GET /api/applications`, `GET /api/domains` e `GET /api/bindings` existem mas retornam a tabela inteira sem filtro por `projectId`/`applicationId` (aceitável por ora — instância single-tenant, F1 — mas o FE precisa filtrar no cliente).

Correções:
1. **BE**: adicionar `GET /api/service-instances` (mesmo padrão de `listApplications`/`listDomains`/`listBindings` — sem filtro de query, retorna tudo).
2. **FE**: reescrever `project-detail.tsx` para buscar `GET /api/applications`, `GET /api/service-instances`, `GET /api/domains`, `GET /api/deployments`, `GET /api/bindings`, `GET /api/service-templates` (loading/error state) em vez dos imports de `mock-data`, filtrando client-side por `project.id` e `environment` como já faz hoje com os mocks. Mesmo padrão de loading usado em `projects-grid.tsx`/`project-detail-loader.tsx`. ✅ (commits `951ab5d`, `95250e4`)

## Bug crítico #3: node de serviço perde ícone/nome após reload (dois "template id" diferentes)

Achado ao validar o bug #2 ao vivo: depois do reload, o node do Redis persiste (bug #2 corrigido), mas mostra ícone genérico e o UUID cru em vez de "Redis 8". Causa raiz: existem **dois namespaces de "template id" diferentes** que nunca foram reconciliados:

- `GET /api/service-templates` retorna `serviceCatalog` (`src/server/catalog.ts`), um catálogo estático usado pelo AddPalette pra ícones/branding — `id` aqui é um slug amigável (`"redis"`, `"postgresql"`...).
- `service_instances.templateId` no banco guarda o **UUID real** de `service_templates.id` (resolvido dentro de `createService`, que casa o slug do catálogo com a linha do banco por `name`).

`project-canvas.tsx` faz `templates.find((item) => item.id === service.templateId)` comparando o slug do catálogo contra o UUID do banco — nunca bate. Na criação (mesma sessão) o node usa o `item` do palette diretamente, por isso parecia certo; só depois do reload (lendo `service.templateId` real) o bug aparece.

Correção:
1. **Contrato** (`src/lib/types.ts`, CEO): adicionar `templateName: string` em `ServiceInstance`.
2. **BE**: em `src/server/services/services.ts`, popular `templateName` (join/lookup em `schema.serviceTemplates` por `id`) em `listServices`, `getService` e no retorno de `createService`.
3. **FE**: em `project-canvas.tsx`, trocar o matching de `templates.find((item) => item.id === service.templateId)` para `templates.find((item) => item.name === service.templateName)`.

## Bug crítico #4: resto do dashboard ainda 100% mock

Varredura (`grep -rl "@/lib/mock-data" src/app src/components`) depois de corrigir #1-#3: praticamente toda página fora do canvas de projeto ainda lê `mock-data.ts` direto, com zero fetch pra API real. Todos os endpoints GET necessários **já existem** (nenhuma dependência do BE) — isso é 100% escopo FE:

- **`src/app/(dashboard)/home/page.tsx`**: stats do dashboard (contagem de projetos, apps rodando, deploys hoje, servidores online) e a lista "Recent deployments" — tudo de `mockProjects`/`mockApplications`/`mockDeployments`/`mockServers`.
- **`src/app/(dashboard)/servers/page.tsx`**: lista de servidores de `mockServers` em vez de `GET /api/servers` (que já existe e já é usado no formulário de New Project).
- **`src/app/(dashboard)/domains/page.tsx`**: tabela de `mockDomains`/`mockApplications`. Mais grave: o diálogo "Add Domain" **não chama a API** — o `submit()` só faz `setOpen(false)` + `toast.success(...)` local, nunca `POST /api/domains`.
- **`src/app/(dashboard)/monitoring/page.tsx`**: métricas de servidor e health de aplicação inteiramente de mock.
- **`src/components/command-palette.tsx`** (⌘K): lista de projetos de `mockProjects` — projetos criados de verdade não aparecem na busca rápida.
- **`src/components/deployments-table.tsx`**: resolve nome da app via `mockApplications` (mesmo se a lista de deployments em si já vier real).
- **`src/components/projects-grid.tsx`**: já busca `GET /api/projects` (bug #1), mas o enriquecimento por card (contagem de apps, último deploy) ainda filtra `mockApplications`/`mockDeployments` por `project.id` — como o id agora é UUID real, sempre bate zero (por coincidência parece "0 apps", mas pelo motivo errado).

Correção (tudo FE, endpoints já existem — `GET /api/projects`, `GET /api/applications`, `GET /api/servers`, `GET /api/domains`, `GET /api/deployments`, `POST /api/domains`):
1. `projects-grid.tsx`: trocar o enriquecimento mock por fetch real de applications/deployments (mesmo padrão já usado pra `allProjects`).
2. `home/page.tsx`, `monitoring/page.tsx`: buscar projects/applications/servers/deployments reais em vez de mock.
3. `servers/page.tsx`: `GET /api/servers` em vez de `mockServers`.
4. `domains/page.tsx`: `GET /api/domains` + `GET /api/applications` pra tabela e o seletor do diálogo; `submit()` passa a fazer `POST /api/domains` de verdade (loading/error, fechar diálogo só após sucesso).
5. `command-palette.tsx`: `GET /api/projects` em vez de `mockProjects`.
6. `deployments-table.tsx`: `GET /api/applications` em vez de `mockApplications` pra resolver nomes.

Recomendo commits pequenos por página/componente (mesmo padrão já usado nos bugs #1-#3), lint/build a cada um.

## Bug crítico #5: conectar app a serviço no canvas é 100% fake

Achado testando ao vivo o pedido do usuário ("testa o fluxo de conectar um app a um serviço"): arrastar uma conexão de uma Application pra um Service no canvas mostra o edge tracejado, injeta o toast "REDIS_URL injected into qa-test-app"... e nada mais. Confirmado com `read_network_requests`: **nenhuma chamada de rede acontece**. Dando reload na página, o edge desaparece — a conexão nunca existiu fora do estado local do React.

Causa raiz em `project-canvas.tsx`:
- `onConnect` (linha ~606): calcula a `injectedVarKey` certa (via `injectedKey(target.data.template)`) e só faz `setEdges((current) => [...current, {...}])` — nunca chama `POST /api/bindings`, que já existe e já está implementado (`createBinding` em `src/server/services/bindings.ts`).
- `onEdgesChange` (linha 469) é o handler puro do `useEdgesState` do React Flow (via `deleteKeyCode={["Backspace","Delete"]}`) — apagar uma aresta também nunca chama `DELETE /api/bindings` (que também já existe).
- A leitura já é real (`initialEdges` filtra o array `bindings` vindo de `GET /api/bindings`, corrigido no bug #2) — só a escrita (criar/apagar binding) ficou de fora.

Correção (100% FE — `POST` e `DELETE /api/bindings` já existem e já são usados noutros lugares):
1. `onConnect`: depois das validações existentes (app↔service, duplicata), fazer `POST /api/bindings` com `{ applicationId, serviceInstanceId }`; só chamar `setEdges(...)` e o toast de sucesso dentro do `.then()`, com o `id` real retornado pela API (não `binding_${Date.now()}`). Em caso de erro, não adicionar o edge e mostrar `toast.error`.
2. Interceptar a remoção de aresta (usar o `onEdgesChange` do React Flow filtrando por `type === "remove"`, ou um `onEdgeClick`/botão dedicado se já existir affordance de deletar edge) pra chamar `DELETE /api/bindings?id=...` antes de remover do estado local.
3. Reusar o padrão de loading/erro já estabelecido (toast de erro se o POST/DELETE falhar, sem deixar o canvas num estado inconsistente com o banco).

## Bug crítico #6 (P0 — bloqueia o instalador): produção não roda migrations em lugar nenhum

Pergunta do usuário: "se eu instalar vai funcionar?" — resposta honesta hoje é **não**. Investigação:

- README documenta `pnpm db:migrate` como passo manual do fluxo de **dev**. O instalador de produção (`curl -fsSL get.olym.sh | bash` → `docker-compose.prod.yml`) não tem equivalente nenhum.
- `Dockerfile` (estágio `runner`) só copia `public`, `.next/standalone`, `.next/static` e `dist/worker.cjs` — nunca `src/db/migrations/` nem `drizzle.config.ts`. `drizzle-kit` é devDependency e nem o `node_modules` completo chega no runner (só o podado do `.next/standalone`).
- Resultado: numa instalação nova, o Postgres sobe vazio (sem nenhuma tabela) e o Next.js tenta consultar `users`/`projects`/etc. desde o primeiro request — `GET /api/auth/status` (chamado pela tela de login/setup) já quebra com erro cru do Postgres. **Nada funciona a partir da primeira tela.**

Correção (padrão igual ao já usado pro worker — `build:worker`/`dist/worker.cjs`):
1. Novo `src/server/migrate.ts`: usa `migrate()` de `drizzle-orm/node-postgres/migrator` apontando pra `./src/db/migrations`, conecta via `DATABASE_URL`, roda e sai (`process.exit(0)` em sucesso, `process.exit(1)` logando o erro em falha).
2. `package.json`: `"build:migrate": "esbuild src/server/migrate.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/migrate.cjs --external:pg-native --external:cpu-features"` (mesmo padrão do `build:worker`).
3. `Dockerfile`: builder roda `pnpm build && pnpm build:worker && pnpm build:migrate`; runner ganha `COPY --from=builder .../dist/migrate.cjs ./migrate.cjs` **e** `COPY --from=builder .../src/db/migrations ./src/db/migrations` (o `migrationsFolder` do drizzle precisa dos `.sql` + `meta/_journal.json` como arquivos estáticos, não só o bundle JS).
4. `docker/docker-compose.prod.yml`: novo serviço one-off `migrate` (mesma imagem, `command: ["node", "migrate.cjs"]`, `restart: "no"`, `depends_on: postgres: condition: service_healthy`, só precisa de `DATABASE_URL`). `olym` e `olym-worker` passam a ter `depends_on: migrate: condition: service_completed_successfully` além do que já têm.
5. Idempotência: `migrate()` do drizzle já é idempotente (registra migrations aplicadas), então isso também cobre upgrades futuros (novo `OLYM_VERSION` com migrations novas) — rodar de novo o compose reaplica só o que falta.

Território: `Dockerfile`, `docker-compose.prod.yml`, `package.json`, `src/server/` → **BE**.

## Bug crítico #7 (P0 — ainda mais fundamental que #6): `docker build` falha hoje, não gera imagem nenhuma

Rodei `docker build -t olym-build-test --target runner .` localmente pra validar o build de verdade (não só ler o Dockerfile). **Falha com exit code 1** no primeiro estágio (`deps`):

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: cpu-features@0.0.10, esbuild@0.18.20, esbuild@0.25.12, esbuild@0.28.1, msgpackr-extract@3.0.4, protobufjs@7.6.5, sharp@0.34.5, ssh2@1.17.0, unrs-resolver@1.12.2
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Causa raiz: `package.json` não tem campo `"packageManager"` fixando a versão do pnpm. `Dockerfile` faz só `corepack enable` (sem versão pinada), então o Corepack baixa o pnpm mais recente disponível (constatei: **pnpm 11.15.1**, bem diferente do pnpm 9.15.4 usado localmente/no `pnpm-lock.yaml` lockfileVersion 9.0). Esse pnpm mais novo bloqueia por padrão scripts de build/postinstall de dependências nativas (proteção supply-chain) a menos que aprovados explicitamente — e não tem como aprovar interativamente dentro de um `docker build`. **Isso quebra o build da imagem inteira, inclusive o workflow de CI `docker-publish.yml`** — não é só o instalador que não funciona, a imagem nem chega a ser publicada.

Correção (`package.json`, sem tocar em código de produto):
1. Fixar a versão do pnpm: `"packageManager": "pnpm@9.15.4"` (a mesma já usada localmente, compatível com `lockfileVersion: '9.0'`) — garante que `corepack enable` sempre resolve pra essa versão exata, em dev, CI e Docker.
2. Mesmo fixando a versão, listar explicitamente os pacotes que precisam rodar seus scripts de build nativos, via `"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp", "ssh2", "cpu-features", "msgpackr-extract", "protobufjs", "unrs-resolver"] }` — isso pré-aprova esses pacotes sem exigir `pnpm approve-builds` interativo (mecanismo documentado do pnpm 9+ para builds não-interativos/CI).
3. Validar rodando `docker build --target runner .` local de verdade depois da correção (não só lint/build do Next) — é o único jeito de confirmar que resolveu, porque o erro só aparece dentro do ambiente limpo do Docker/Corepack, não no `node_modules` local já instalado.

Território: só `package.json` (nenhuma mudança de código). Prioridade igual ou maior que o bug #6 — sem isso a imagem nem builda, então a correção de migrations do #6 nunca chega a rodar em lugar nenhum.

## Regras para o squad

1. Frontend não toca em `src/server` e `src/db`; Backend não toca em `src/app/(dashboard)` e `src/components` (exceto `src/app/api`). Contrato entre os dois: tipos em `src/lib/types.ts`.
2. Todo trabalho termina com `pnpm lint && pnpm build` passando.
3. Commits pequenos e frequentes na branch `main` (por enquanto). Mensagens em inglês, convencionais (`feat:`, `fix:`).
4. Dados mock realistas em `src/lib/mock-data.ts` (Frontend cria, Backend substitui por queries reais na F2).
