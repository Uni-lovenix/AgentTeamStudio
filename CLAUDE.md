# CLAUDE.md -- Agent Team Studio Quick Reference

## Project

Cross-platform Electron desktop app that turns a project requirement description into an editable multi-agent team configuration and writes it to an existing project directory as `AGENTS.team.md`, `agents.json`, and a core RUP harness.

## Multi-Agent Collaboration Model

Generated teams always include a Planner (`规划者`) and Evaluator (`评估者`), plus one or more responsibility-specific Developer (`开发者`) roles. Generated teams use a lightweight RUP process with Inception, Elaboration, Construction, and Transition phases. Every iteration starts with an iteration protocol: Planner defines it, Developers build against it, Evaluator validates it against phase exit criteria, and any issues are sent back to the responsible Developer until accepted.

No separate RUP roles such as architect, tester, deployment engineer, or project manager are generated; the Planner, Evaluator, Developer, and documentation handoff roles carry the process responsibilities.

## Commands

```bash
bash init.sh            # install, check, test, build, verify harness
npm run dev             # build and launch Electron
npm run check           # strict TypeScript checks
npm test                # Vitest unit tests
npm run build           # compile main/preload/renderer
npm run dist:mac        # package macOS
npm run dist:win        # package Windows
bash scripts/benchmark.sh
bash scripts/cleanup-scanner.sh
```

## Architecture

Renderer React -> `window.agentTeamStudio` -> preload -> IPC -> main handlers -> services -> filesystem.

All IPC channels and shared types live in `src/shared/types.ts`. Do not create a second channel source of truth.

## Services

- `ProjectService`: local project draft CRUD.
- `RequirementAnalyzer`: local keyword-based team generation.
- `LlmClient`: optional OpenAI-compatible `/chat/completions` client.
- `TeamGenerationService`: local/LLM generation with validation and fallback.
- `ProjectWriter`: atomic export of `AGENTS.team.md`, `agents.json`, and missing core harness and scoring files.
- `HarnessTemplates`: pure renderers for `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`, `init.sh`, and `docs/PROCESS.md`.
- `TeamConfigValidator`: validates and repairs role `kind`, IDs, workflow/RUP references, and generated harness completeness.
- `ProcessManagement`: shared RUP phase/iteration model used by generation, normalization, migration, and export.
- `SettingsService`: LLM settings with encrypted API key storage.
- `PersistenceService`: JSON persistence under Electron `userData`.

## Output Files

- `AGENTS.team.md`: human/agent-readable team, RUP process, workflow, and engineering conventions.
- `agents.json`: schema version 3 machine-readable team config with stable role `kind`.
- `AGENTS.md` / `CLAUDE.md`: initialized by default as rule/agent maps when missing; existing files only receive pointer.
- `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`, `docs/PROCESS.md`: core RUP harness state and lifecycle files, created only when missing.
- `quality-document.md`, `evaluator-rubric.md`, `clean-state-checklist.md`: fillable quality scorecard, iteration review rubric, and clean-state checklist, created only when missing.

## Boundaries

- Renderer must not import Node.js modules.
- Filesystem and dialogs stay in main process.
- API keys never enter renderer or target project directories.
- Reset clears local app data only; it never deletes target project files.
