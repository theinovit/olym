# Hefesto — Design Brief

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

- **Sidebar fixa esquerda** (usar componente `sidebar` do shadcn): logo Hefesto no topo + theme toggle; grupos **MAIN** (Home, Projects, Deployments, Inbox), **SETTINGS** (Settings), **INFRASTRUCTURE** (Servers, Monitoring, Domains); CTA "+ New Project"; footer com conta do usuário.
- **Conteúdo**: header da página com breadcrumb/título à esquerda e ações à direita; grid de cards.
- **Tela New Project** (espelhar screenshot): seletor de Framework (tabs Frontend/Backend/Fullstack/Static + grid de tiles com logo), card "Deploy Configuration" (install/build/start commands, port, output dir, toggles), coluna direita com repo picker, Build Location (Server/Local), Domain (free subdomain `.hefesto.app` / custom), botão preto **Deploy** full-width e card "Deploy Summary".

## Anti-padrões (proibido)

- Gradientes espalhados, glassmorphism, neon, sombras pesadas.
- Emoji na UI. Cores saturadas de fundo em áreas grandes.
- Mudar tokens do tema em `globals.css` sem coordenar com o CEO.
