# Contributing to Olym

Olym is open source and welcomes contributions, but it's early and the API surface (deploy engine, DB schema, canvas UX) is still moving fast. These rules exist to keep quality high without slowing everyone down.

## Ground rules

1. **Open an issue before a large PR.** Bug fixes, small polish, and docs can go straight to a PR. Anything that touches the deploy engine, DB schema, or introduces a new dependency needs an issue first so we can align on direction before you spend time on it.
2. **Small, focused PRs.** One concern per PR. Large, multi-purpose PRs are hard to review and easy to get wrong — split them.
3. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` — keep messages in English, imperative mood.
4. **`pnpm lint && pnpm build` must pass** before you open a PR. CI enforces this on every PR to `main`; it won't merge if either fails.
5. **No secrets, no arbitrary destructive commands.** Anything touching `src/server` (Docker, Git, deploy execution) gets extra scrutiny — this code runs with access to the Docker socket and clones third-party repos.
6. **`main` is protected.** Changes land via PR with at least one review and a passing CI run — no direct pushes, including from maintainers.

## Project structure

See `ARCHITECTURE.md` for the technical breakdown (folders, entities, phases) and `DESIGN.md` for the UI/UX language and its history. Territory boundaries (frontend vs. backend) described there still apply to contributors.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm db:migrate   # optional — the app runs on mock data without a DATABASE_URL
pnpm db:seed
pnpm dev
```

## Reporting issues

Include reproduction steps, what you expected, and what happened instead. For security-sensitive issues (anything that could lead to remote code execution, secret leakage, or container escape), please do not open a public issue — reach out to the maintainers privately first.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
