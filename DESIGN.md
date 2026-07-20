# Olym — Design Brief

Referência visual: OpenShip (screenshot em anexo do CEO). Clean, leve, "soft", profissional.

## Princípios

1. **Light mode é o default.** Dark mode completo via next-themes (`class` strategy), toggle no topo da sidebar.
2. Fundo geral `bg-neutral-50` (light) / `bg-neutral-950` (dark); superfícies de card brancas com **borda sutil** (`border-neutral-200`) e `rounded-xl`/`rounded-2xl`. Sombras quase imperceptíveis (`shadow-sm` no máximo).
3. Tipografia Geist (já configurada). Títulos `font-semibold`, nunca `font-bold` gritante. Labels de seção da sidebar em `text-[11px] uppercase tracking-wider text-muted-foreground`.
4. Densidade confortável: paddings generosos (`p-5`/`p-6` em cards), nada apertado.
5. Cor: interface ~monocromática neutra. **Primary = preto** (botões de ação principal, ex.: "Deploy"). Um único acento gradiente sutil violeta→azul reservado para o CTA "+ New Project" na sidebar. Cores semânticas só para status.
6. Status: dot + label — verde (running/success), âmbar (building/pending), vermelho (failed), cinza (stopped). Sempre com `Badge` suave (bg-*-50 text-*-700 border-*-200), nunca cores saturadas de fundo.
7. Ícones: lucide-react, `size-4`, stroke padrão. Logos de frameworks/serviços em tiles `rounded-lg border` como no screenshot.
8. Microinterações discretas: `transition-colors`, hover levinho (`hover:bg-neutral-100`). Nada de animação chamativa.

## Layout

- **Sidebar fixa esquerda** (usar componente `sidebar` do shadcn): logo Olym no topo + theme toggle; grupos **MAIN** (Home, Projects, Deployments, Inbox), **SETTINGS** (Settings), **INFRASTRUCTURE** (Servers, Monitoring, Domains); CTA "+ New Project"; footer com conta do usuário.
- **Conteúdo**: header da página com breadcrumb/título à esquerda e ações à direita; grid de cards.
- **Tela New Project** (espelhar screenshot): seletor de Framework (tabs Frontend/Backend/Fullstack/Static + grid de tiles com logo), card "Deploy Configuration" (install/build/start commands, port, output dir, toggles), coluna direita com repo picker, Build Location (Server/Local), Domain (free subdomain `.olym.app` / custom), botão preto **Deploy** full-width e card "Deploy Summary".

## Anti-padrões (proibido)

- Gradientes espalhados, glassmorphism, neon, sombras pesadas.
- Emoji na UI. Cores saturadas de fundo em áreas grandes.
- Mudar tokens do tema em `globals.css` sem coordenar com o CEO.

---

## v2 — Project Canvas & identidade visual (direção do CEO, aprovada pelo fundador)

A partir do Sprint 4, o detalhe do projeto evolui para um **canvas estilo Railway**, e o visual ganha identidade própria mantendo a base clean/light.

### Project Canvas

- View padrão do projeto: canvas infinito com **pan (arrastar fundo) e zoom (scroll/pinch)**, fundo **dot-grid** sutil (`radial-gradient` de pontos neutral-300/20 em light, neutral-700/20 em dark).
- Cada **application** e **service** é um nó: card compacto (~220px) com ícone do tipo, nome, status dot pulsante quando running/building, domínio primário e framework/versão. Nós **arrastáveis** com leve spring na soltura.
- **Edges = linhas de pipa**: conexões (app→postgres, app→redis, domain→app) desenhadas em SVG como **cubic bezier com barriga para baixo** — a corda fica frouxa, nunca reta. Fórmula: para A(x1,y1)→B(x2,y2), `sag = min(80, dist*0.25)`; controles `C1=(x1+(x2-x1)*0.25, y1+sag)` e `C2=(x1+(x2-x1)*0.75, y2+sag)`. Stroke 1.5px `neutral-400/60`; conexão ativa (deploy em andamento) ganha **dash animado fluindo** na direção do tráfego e cor ember.
- Tech: `@xyflow/react` (React Flow 12) com custom nodes (cards shadcn) e custom edge (a linha de pipa acima). Controles de zoom discretos no canto inferior; minimap NÃO (ruído).
- Tabs no topo do projeto: **Canvas** (default) | List (a view atual de cards) | Deployments | Settings.

### Identidade visual v2

- Novo acento de marca: **ember** (laranja-fogo da forja, ~`#f54900`/orange-600) usado com extrema parcimônia: glow suave atrás de nós running, edges ativas, focus rings de momentos-chave. O CTA "+ New Project" migra do gradiente violeta para **gradiente ember→âmbar** (herdado da era Hefesto/forja; mantido como acento de marca do Olym).
- **Glow de status**: nó running tem halo `shadow-[0_0_24px] shadow-emerald-500/15`; building, âmbar; failed, vermelho — sempre ≤15% de opacidade.
- **Command palette ⌘K** (shadcn Command em Dialog): navegar para projetos/apps/páginas, ações rápidas (New Project, Deploy). Atalho visível no header.
- Micro-interações: framer-motion apenas em drag do canvas, hover-lift de 1px em cards clicáveis e fade/slide de entrada de páginas (80ms, sutil).
- Tudo continua **light-first**, denso em respiro, primary preto. O canvas é onde a personalidade aparece; o resto permanece sóbrio.

### Logos oficiais (requisito do fundador)

- Todos os frameworks e serviços exibem seus **logos oficiais** — nunca ícones genéricos lucide: nós do canvas, Add Palette, listas de apps/serviços e catálogo one-click.
- Fonte primária: **devicon** (https://devicon.dev — pacote npm `devicon`): usar os SVGs coloridos oficiais (variante `original`/`original-wordmark` conforme contexto; `plain` para contextos monocromáticos). Cobre nextjs, nuxtjs, svelte, remix (checar), django, rails, laravel, symfony, phoenix, postgresql, mysql, mariadb, mongodb, redis, rabbitmq, elasticsearch, docker etc.
- Fallback para marcas que o devicon não tiver (minio, meilisearch, qdrant, clickhouse, traefik…): `simple-icons`, renderizado com a cor oficial da marca.
- Wrapper único `src/components/brand-icon.tsx`: recebe o slug (framework ou template) e resolve devicon→simple-icons→lucide Box (último caso). Import estático dos SVGs (self-hosted, nada de CDN em runtime).
- Fallback para framework "other"/static: lucide Box/FileCode.

---

## v3 — Canvas-first (decisão do fundador, modelo Railway)

O canvas deixa de ser uma view do projeto e vira **A interface do projeto**. Tudo acontece nele:

1. **Criar projeto** = nome + servidor → cai num **canvas vazio** com empty state "Add your first service" (Railway-style). O formulário longo de /projects/new morre como página; vira o painel de configuração do nó.
2. **Botão + Add flutuante** no canvas (canto superior direito): adiciona **Application** (picker de framework com logos oficiais) ou **Service** (catálogo one-click vindo de GET /api/service-templates, com logos oficiais). O nó nasce no canvas na hora.
3. **Clicar num nó** abre um **Sheet lateral direito** (~420px) com tabs: Overview (status, domínio, framework, deploy config), Variables (env vars mascaradas), Domains, Logs (stream SSE), Settings (danger zone). Nada de navegar para outra página — o canvas permanece visível atrás.
4. **Ligar nós arrastando** (handles do React Flow): app→service cria um **Binding** — visualmente a linha de pipa, semanticamente a injeção de credenciais (ex.: ligar app no postgres injeta DATABASE_URL no app; toast confirma). Desligar remove.
5. As linhas de pipa são o grafo REAL de dependências, não decoração.
6. Sidebar global encolhe em favor do canvas: Home, Projects (lista de canvases), Deployments, Infra, Settings continuam, mas o dia-a-dia é dentro do canvas.

### v3.1 — Add Palette estilo Maestri (refinamento do fundador)

O "+ Add" do canvas evolui de Dialog para **painel lateral esquerdo colapsável DENTRO do canvas** (referência: sidebar de workspaces do Maestri):

- Painel ~280px ancorado à esquerda do canvas, **abre/fecha** com toggle (botão + flutuante e atalho `A`), animação slide suave (150ms). Fechado por padrão.
- **Campo de busca no topo** (como o Filter do Maestri): filtra em tempo real a lista unificada de Applications (frameworks) e Services (catálogo da API), agrupados por seção, cada item com logo oficial + nome + descrição curta.
- **Clicar OU arrastar** o item para dentro do canvas cria o nó (drag-and-drop do item direto na posição desejada; clique adiciona no centro visível).
- O painel flutua SOBRE o canvas (overlay com borda/sombra sutil), não empurra o grafo.
- Estética dos controles flutuantes do canvas (zoom, toggle do painel): pills arredondadas discretas, como a toolbar do Maestri — mas na nossa paleta light-first.

### v3.2 — Painel de nó estilo Maestri (substitui o Sheet lateral)

O Sheet de borda de tela morre. Clicar num nó passa a funcionar como no Maestri:

1. **Selecionar um nó** mostra uma **toolbar flutuante em pill** logo acima dele (como a toolbar de seleção do Maestri): ações Deploy, Restart, Logs, Settings, Delete — ícones discretos, tooltip, fundo card com sombra sutil.
2. **Abrir configuração** (clique na ação ou duplo-clique no nó) abre um **card flutuante ancorado ao lado do nó, DENTRO do canvas** (~400px, rounded-2xl, borda + sombra suave): ele acompanha pan/zoom (renderizado no viewport do React Flow, ex.: NodeToolbar/position absoluta no flow), nunca cobre o nó, flipa de lado se faltar espaço.
3. Dentro do card: as mesmas tabs Overview | Variables | Domains | Logs (SSE) | Settings — conteúdo idêntico ao que existia no Sheet, só muda o continente.
4. Fechar: X no card, Esc, ou clicar no vazio do canvas. Um card por vez.
5. O canvas continua 100% interativo com o card aberto (arrastar outros nós, pan).

### v3.3 — Edges estilo Maestri de verdade (feedback do fundador)

1. **Morrem as bolinhas de handle.** Nenhum dot visível nos nós. A conexão é do **bloco inteiro**:
   - Edges usam o padrão **floating edges** do React Flow: a linha ancora dinamicamente no ponto mais próximo do PERÍMETRO do card (recalcula quando o nó é arrastado), nunca num ponto fixo com bolinha.
   - Para criar conexão por arraste: handle invisível cobrindo o nó inteiro (overlay inset-0, opacity 0) — arrasta de qualquer lugar do card de origem e solta em qualquer lugar do card de destino. Cursor crosshair na borda para indicar.
2. **Toda edge é pontilhada** (padrão Maestri): strokeDasharray tipo "7 7", stroke neutral-400/70 (light) / neutral-500/70 (dark), 1.5px. Edge ativa (deploy) mantém ember + animação de fluxo do dash.
3. **Barriga de pipa mais pronunciada**: sag = min(120, dist*0.35) — a corda fica visivelmente frouxa como no Maestri, mesmo em distâncias médias.

### v3.4 — Config em nível de tela + conexão pela borda (feedback do fundador com screenshots Maestri)

1. **O card ancorado ao nó morre** (clipava na borda do canvas). A config abre como **painel em nível de TELA** (fora do transform do React Flow), estilo command-center:
   - Modal centrado grande (~720px, max-h 80vh), backdrop escurecido leve (bg-black/30) SEM blur pesado, rounded-2xl, animação scale-in 120ms.
   - Header: logo + nome + status badge + botão expand (fullscreen toggle: vira inset-4) + X.
   - Mesmas tabs Overview | Variables | Domains | Logs (SSE) | Settings, com respiro (conteúdo max-w prose, p-6).
   - Nunca clipa, nunca cobre o nó de origem permanentemente (o canvas fica visível escurecido atrás; Esc fecha).
2. **Pill de ações = toolbar do Maestri** (referência: pill escura arredondada com ícones separados por divisores): rounded-full, bg-neutral-900/90 no dark e bg-white/95 no light, ícones ghost com divisores verticais 1px, ação destrutiva separada no fim, badge numérico opcional (ex.: deployments ativos) em pill azul/ember.
3. **Conexão pela BORDA do nó** (como Maestri): nó selecionado/hover mostra **borda tracejada** sutil; clicar+arrastar A PARTIR DA BORDA (faixa de 12px, cursor crosshair) puxa a linha de conexão; arrastar do miolo do card move o nó. Os handles invisíveis existem só na faixa de borda.

---

## v4 — Identidade própria: chrome flutuante estilo Maestri (decisão do fundador)

Chega de parecer OpenShip. O produto adota a linguagem espacial do Maestri em TODO o app, não só no canvas:

1. **Morre a sidebar clássica** de coluna cheia. No lugar:
   - **Pill de logo** flutuante no canto superior esquerdo (logo + nome do produto + theme toggle), rounded-2xl, shadow suave.
   - **Nav rail flutuante** vertical à esquerda (ícones com tooltip: Home, Projects, Deployments, Servers, Monitoring, Domains, Settings), pill arredondada solta (não encostada na borda), ativo com fundo suave.
   - **CTA + New Project** vira botão flutuante compacto no rail (gradiente ember, só ícone + tooltip).
   - Conta do usuário: avatar flutuante no canto inferior esquerdo com dropdown.
2. **Fundo dot-grid sutil no app INTEIRO** (não só no canvas) — todas as páginas são "superfícies sobre o grid".
3. **Todo conteúdo flutua**: páginas como Home/Projects/Monitoring viram grupos de cards soltos sobre o grid com sombras Maestri (shadow-sm/md, rounded-2xl), header da página como texto solto sem barra.
4. **Header global some**: o ⌘K vira pill flutuante no canto superior direito.
5. Light-first continua; dark ganha o clima do Maestri (fundo neutral-950, superfícies neutral-900, grid sutil).
6. O canvas do projeto passa a ser **full-bleed** (a página inteira, sem card wrapper) — os controles já flutuam sobre ele.
