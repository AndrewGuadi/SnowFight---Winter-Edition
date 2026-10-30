# SnowFight agent coordination — Ruflo adoption layer

This workspace coordinates development **outside** the game runtime. It does not start agents or run LLMs simply because these files exist.

## Authority

Andrew is product owner and the sole final merge/deployment decision-maker. GPT-6 owns integration and technical review, Kimi owns sprite/animation work, GPT-6.1-Sol owns authoritative networking/AI, and Meta Muse owns UX/accessibility/browser QA. No collaborator may assume access to another environment.

## Environments

Base: `docs/rebuild-reuse-first-2026-10-30`. This orchestration work runs in `chore/ruflo-swarm-coordination`. No changes may be written directly to `main` or the parked full-stack rewrite.

Ruflo is used as an optional **ledger, memory and orchestration tool**. Actual edits, commands and tests must run in the configured coding-agent environment, in separate worktrees/branches. Ruflo is not installed into the game build or called from browser gameplay.

## Minimal setup (local development environment only)

1. Check out this branch in a separate Git worktree. Install Node >=20.
2. Review the Ruflo source and dependency licensing at https://github.com/AndrewGuadi/ruflo-agent-swarm-llms. The repo's package describes version 3.57.0, while some docs cite other versions; pin an actually verified published version before use.
3. In the worktree, run `npx ruflo@<verified-version> init wizard` only after inspecting the resulting configuration and command options. Do not use an unreviewed `--fix` or installation hook in a production environment.
4. Inspect `npx ruflo@<verified-version> mcp list` and `doctor`. Record actual capabilities and failed checks. Configure MCP individually for each supported coding client, with narrowly scoped permissions.
5. Use `node scripts/swarm/check.mjs` to validate the tracked orchestration manifest before assigning work. Read `AGENTS.md` and all `docs/rebuild` files.
6. Integrate each worker output through one branch per task, tests and review. Each participant must independently accept the task; configuration files alone do not dispatch Kimi, Muse, Sol or GPT-6.

## Initial tasks

See `tasks.json` and `ownership.json`. Work order: Kimi visual animation -> Muse viewport/PWA and UX acceptance -> Sol AI/network review -> GPT-6 integration, with independent files or isolated worktrees. Run browser and backend tests before any proposed merge.

## Coordination contract

Every task needs task ID, owner, reviewer, base SHA, allowed paths, branch, inputs, acceptance criteria, results and evidence. Never run two writers on the same worktree. The coordinator checks for conflicting writable paths and circular dependencies before task dispatch. Refuse tasks requiring secrets or production credentials.

All release actions remain manual owner-approved gates. No unattended merge, automatic deployment, or contest submission.
