# AGENTS.md -- Agent Team Studio

## Startup Rules

Before writing any code, complete these steps in order:

1. **Read this file completely.** It defines the boundaries and conventions for this project.
2. **Read `CLAUDE.md`** for the quick reference.
3. **Read `docs/ARCHITECTURE.md`** to understand the Electron layer structure and data flow.
4. **Read `docs/PRODUCT.md`** to understand the feature requirements.
5. **Read `docs/RELIABILITY.md`** to understand logging, observability, and clean state requirements.
6. **Read `docs/PROCESS.md`** to understand how future feature work uses RUP phases and iterations.
7. **Run `bash init.sh`** to verify the project builds and initializes cleanly.
8. **Read `feature_list.json`** to see the current state of all features.
9. **Commit modified files** commit already files to remote.

## Project Context

Agent Team Studio is a cross-platform Electron desktop application for Windows and macOS. Users paste a project requirement description, the app designs a multi-agent team, and the user can edit and export the team configuration plus a core RUP harness into an existing project directory as `AGENTS.team.md`, `agents.json`, and missing harness files such as `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`, and `docs/PROCESS.md`.

The first version generates team configuration and RUP harness files. It does not execute agents or scaffold new source projects.

Generated teams use schema v3 with a stable `kind` on every role. `AGENTS.md` / `CLAUDE.md` are generated as rule and agent maps, not operating manuals; each agent reads only its own `agents/*.md` file.

## Multi-Agent Collaboration Model

Generated teams always include these roles:

- Planner (`规划者`): decomposes tasks, plans solutions, coordinates the process, and creates an iteration protocol before each iteration.
- Evaluator (`评估者`): checks developer results against the iteration protocol and sends issues back to the responsible developers.
- Developer (`开发者`): implements tasks against the iteration protocol. There may be multiple responsibility-specific developers.

Generated teams use a lightweight RUP process with four phases: Inception, Elaboration, Construction, and Transition. Every iteration starts with an iteration protocol. Developers use it to build, Evaluator uses it to validate phase milestones and exit criteria, and feedback loops back to the relevant developer until accepted.

## Docs Hierarchy

```
docs/
  ARCHITECTURE.md   -- Electron layers, IPC, services, data flow
  PRODUCT.md        -- Feature requirements and user-facing behavior
  RELIABILITY.md    -- Logging, LLM secrets, clean state, benchmarking
  PROCESS.md        -- RUP process management for future feature work
  quality-document.md  -- 质量文档
```

## Electron Layer Boundaries

### Main Process (`src/main/`)
- Owns BrowserWindow lifecycle and IPC registration.
- All filesystem access happens here via services.
- Structured logging for all IPC events.

### Preload (`src/preload/`)
- The ONLY bridge between main and renderer.
- Uses `contextBridge.exposeInMainWorld` to expose typed APIs.
- Exposes: `projects`, `team`, `dialog`, `settings`, `app` namespaces.

### Renderer (`src/renderer/`)
- React + TypeScript UI layer.
- Communicates exclusively through `window.agentTeamStudio`.
- Never imports Node.js modules.

### Services (`src/services/`)
- Pure TypeScript business logic in the main process.
- Constructor-injected `PersistenceService` where persistence is needed.
- All services use `logger.forService()` for structured JSON output.

## Conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Named exports only.
- IPC channels defined once in `src/shared/types.ts`.
- New IPC channels follow the pattern: `namespace:action`.
- All service methods log at INFO level for significant events.
- DEBUG level for routine data access.
- WARN for missing but non-critical data.
- ERROR for failures.

## Definition of Done

A feature is "done" when:

1. TypeScript compiles without errors (`npm run check`).
2. The app launches and the window is visible.
3. The feature appears in `feature_list.json` with status `"pass"`, evidence, and `rupPhase`/`iteration` for new feature entries.
4. The code respects Electron layer boundaries.
5. Structured logging covers all service operations.
6. `docs/ARCHITECTURE.md` and/or `docs/PRODUCT.md` are updated.
7. `clean-state-checklist.md` passes all checks.

## Session Handoff

When resuming work, read `session-handoff.md` for context from the previous session. When finishing a session, update it with:

- What was accomplished
- What remains
- Any blockers or decisions made
- Files that were modified
- Benchmark results if applicable

## Clean State

Before each major testing cycle:

1. Run `bash scripts/cleanup-scanner.sh` to check for stale artifacts.
2. Use the in-app Reset button or `app:reset` IPC to clear local drafts and settings.
3. Verify `clean-state-checklist.md` passes.
4. Run `bash scripts/benchmark.sh` to measure performance.
